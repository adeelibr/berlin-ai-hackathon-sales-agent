import http from "node:http";
import { URL } from "node:url";
import { WebSocketServer, WebSocket } from "ws";
import * as wrtcModule from "@roamhq/wrtc";
import { supabaseAdmin } from "../../src/integrations/supabase/client.server";
import {
  buildTranscriptText,
  generateAgentReply,
  parseTranscriptText,
  synthesizeSpeech,
  transcribeAudio,
  type FlowContext,
  type Turn,
} from "../../src/lib/conversation-core";
import { bytesToBase64, base64ToBytes, decodeWav, resamplePcm16 } from "../../src/lib/audio-utils";
import { mapDummyStatusToRunStatus, type DummyCallStatus } from "../../src/lib/dummy-phone";

const wrtc = ((wrtcModule as unknown as { default?: unknown }).default ?? wrtcModule) as {
  RTCPeerConnection: typeof RTCPeerConnection;
  RTCSessionDescription: typeof RTCSessionDescription;
  RTCIceCandidate: typeof RTCIceCandidate;
  nonstandard: {
    RTCAudioSource: new () => {
      createTrack: () => MediaStreamTrack;
      onData: (data: {
        samples: Int16Array;
        sampleRate: number;
        bitsPerSample: number;
        channelCount: number;
        numberOfFrames: number;
      }) => void;
    };
    RTCAudioSink: new (track: MediaStreamTrack) => {
      ondata:
        | null
        | ((data: {
            samples: Int16Array;
            sampleRate: number;
            bitsPerSample: number;
            channelCount: number;
            numberOfFrames: number;
          }) => void);
      stop: () => void;
    };
  };
};

type HandsetRegistration = {
  number: string;
  sessionId: string;
  socket: WebSocket;
};

type CallSession = {
  id: string;
  runId: string;
  number: string;
  flow: FlowContext;
  callerLabel: string;
  handset: HandsetRegistration;
  history: Turn[];
  status: DummyCallStatus;
  peerConnection: RTCPeerConnection | null;
  audioSource: InstanceType<typeof wrtc.nonstandard.RTCAudioSource> | null;
  audioTrack: MediaStreamTrack | null;
  audioSink: InstanceType<typeof wrtc.nonstandard.RTCAudioSink> | null;
  assistantSpeaking: boolean;
  processingTurn: boolean;
  greetingStarted: boolean;
  ended: boolean;
  awaitingSilenceMs: number;
  utteranceMs: number;
  captureRate: number;
  captureChunks: Int16Array[];
  ringTimeout: NodeJS.Timeout | null;
};

const PORT = Number(process.env.DUMMY_PHONE_MEDIA_PORT || 8788);
const CALLER_LABEL = process.env.DUMMY_PHONE_CALLER_LABEL || "Stillwater Demo";
const RING_TIMEOUT_MS = 30_000;
const VAD_THRESHOLD = 1200;
const VAD_SILENCE_MS = 800;
const VAD_MAX_UTTERANCE_MS = 8000;
const OUTBOUND_SAMPLE_RATE = 48_000;
const OUTBOUND_FRAME_SIZE = 480;

const handsetsByNumber = new Map<string, HandsetRegistration>();
const callsById = new Map<string, CallSession>();

const server = http.createServer(async (req, res) => {
  const method = req.method || "GET";
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

  if (method === "GET" && url.pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === "POST" && url.pathname === "/calls") {
    const body = await readJsonBody(req).catch(() => null);
    if (!body || typeof body !== "object") {
      sendJson(res, 400, { error: "Invalid JSON body" });
      return;
    }

    const runId = typeof body.runId === "string" ? body.runId : null;
    const number = typeof body.number === "string" ? body.number : null;
    const whoWeAre = typeof body.whoWeAre === "string" ? body.whoWeAre : "";
    const whatWeDo = typeof body.whatWeDo === "string" ? body.whatWeDo : "";
    const persona = typeof body.persona === "string" ? body.persona : "";

    if (!runId || !number) {
      sendJson(res, 400, { error: "runId and number are required" });
      return;
    }

    const handset = handsetsByNumber.get(number);
    if (!handset || handset.socket.readyState !== WebSocket.OPEN) {
      sendJson(res, 409, { error: `No dummy handset is registered for ${number}` });
      return;
    }

    const { data: run, error: runError } = await supabaseAdmin
      .from("runs")
      .select("transcript")
      .eq("id", runId)
      .maybeSingle();

    if (runError) {
      sendJson(res, 500, { error: runError.message });
      return;
    }

    const callId = crypto.randomUUID();
    const call: CallSession = {
      id: callId,
      runId,
      number,
      flow: {
        whoWeAre,
        whatWeDo,
        persona,
      },
      callerLabel: CALLER_LABEL,
      handset,
      history: parseTranscriptText(run?.transcript ?? ""),
      status: "ringing",
      peerConnection: null,
      audioSource: null,
      audioTrack: null,
      audioSink: null,
      assistantSpeaking: false,
      processingTurn: false,
      greetingStarted: false,
      ended: false,
      awaitingSilenceMs: 0,
      utteranceMs: 0,
      captureRate: OUTBOUND_SAMPLE_RATE,
      captureChunks: [],
      ringTimeout: null,
    };

    callsById.set(callId, call);
    call.ringTimeout = setTimeout(() => {
      void endCall(call, "no-answer", "Call timed out before it was answered");
    }, RING_TIMEOUT_MS);

    await updateRun(call, "ringing", {
      call_transport: "dummy",
      dummy_call_id: callId,
      dummy_call_status: "ringing",
      dummy_device_session_id: handset.sessionId,
      target_phone_number: number,
      error: null,
    });

    send(handset.socket, {
      type: "incoming_call",
      callId,
      callerLabel: CALLER_LABEL,
      number,
    });

    sendJson(res, 200, {
      callId,
      sessionId: handset.sessionId,
      status: "ringing",
    });
    return;
  }

  if (method === "POST" && /^\/calls\/[^/]+\/hangup$/.test(url.pathname)) {
    const [, , callId] = url.pathname.split("/");
    const call = callsById.get(callId);
    if (!call) {
      sendJson(res, 404, { error: "Call not found" });
      return;
    }

    await endCall(
      call,
      call.status === "in-progress" ? "completed" : "canceled",
      "Call ended by controller",
    );
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "Not found" });
});

const wss = new WebSocketServer({ noServer: true });

wss.on("connection", (socket, request, meta: { number: string; sessionId: string }) => {
  const registration: HandsetRegistration = {
    number: meta.number,
    sessionId: meta.sessionId,
    socket,
  };

  const existing = handsetsByNumber.get(meta.number);
  if (existing && existing.sessionId !== meta.sessionId) {
    send(existing.socket, {
      type: "replaced",
      reason: "This dummy number was opened in a newer session.",
    });
    existing.socket.close();
  }

  handsetsByNumber.set(meta.number, registration);
  send(socket, {
    type: "registered",
    number: meta.number,
    sessionId: meta.sessionId,
  });

  socket.on("message", async (raw) => {
    const message = parseMessage(raw);
    if (!message || typeof message.type !== "string") return;

    const callId = typeof message.callId === "string" ? message.callId : null;
    const call = callId ? callsById.get(callId) : null;
    if (!call || call.handset.sessionId !== registration.sessionId) return;

    if (message.type === "accept_call") {
      clearRingTimeout(call);
      call.status = "connecting";
      await updateRun(call, "ringing", {
        dummy_call_status: "connecting",
        error: null,
      });
      return;
    }

    if (message.type === "decline_call") {
      await endCall(call, "canceled", "Call declined");
      return;
    }

    if (message.type === "hangup") {
      await endCall(call, call.status === "in-progress" ? "completed" : "canceled", "Call ended");
      return;
    }

    if (message.type === "mute_changed") {
      return;
    }

    if (message.type === "peer_offer" && message.sdp) {
      await ensurePeerConnection(call);
      await call.peerConnection?.setRemoteDescription(new wrtc.RTCSessionDescription(message.sdp));
      const answer = await call.peerConnection?.createAnswer();
      if (!answer || !call.peerConnection) return;
      await call.peerConnection.setLocalDescription(answer);
      send(registration.socket, {
        type: "peer_answer",
        callId: call.id,
        sdp: answer,
      });
      return;
    }

    if (message.type === "peer_ice" && message.candidate && call.peerConnection) {
      await call.peerConnection
        .addIceCandidate(new wrtc.RTCIceCandidate(message.candidate))
        .catch(() => {
          // Ignore late ICE candidates during teardown.
        });
    }
  });

  socket.on("close", () => {
    const current = handsetsByNumber.get(registration.number);
    if (current?.sessionId === registration.sessionId) {
      handsetsByNumber.delete(registration.number);
    }

    for (const call of callsById.values()) {
      if (call.handset.sessionId !== registration.sessionId || call.ended) continue;
      const nextStatus: DummyCallStatus = call.status === "in-progress" ? "failed" : "no-answer";
      void endCall(call, nextStatus, "Handset disconnected");
    }
  });
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (url.pathname !== "/ws/phone-dummy") {
    socket.destroy();
    return;
  }

  const number = url.searchParams.get("number");
  const sessionId = url.searchParams.get("sessionId");
  if (!number || !sessionId) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request, { number, sessionId });
  });
});

server.listen(PORT, () => {
  console.log(`[dummy-phone-media] listening on http://localhost:${PORT}`);
});

function parseMessage(raw: WebSocket.RawData) {
  try {
    return JSON.parse(raw.toString());
  } catch {
    return null;
  }
}

async function ensurePeerConnection(call: CallSession) {
  if (call.peerConnection) return;

  const peerConnection = new wrtc.RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  const audioSource = new wrtc.nonstandard.RTCAudioSource();
  const audioTrack = audioSource.createTrack();

  peerConnection.addTrack(audioTrack);
  peerConnection.onicecandidate = (event) => {
    if (!event.candidate) return;
    send(call.handset.socket, {
      type: "peer_ice",
      callId: call.id,
      candidate: event.candidate.toJSON(),
    });
  };

  peerConnection.ontrack = (event) => {
    if (event.track.kind !== "audio") return;
    const sink = new wrtc.nonstandard.RTCAudioSink(event.track);
    sink.ondata = (data) => {
      void handleIncomingAudio(call, data);
    };
    call.audioSink = sink;
  };

  peerConnection.onconnectionstatechange = () => {
    if (peerConnection.connectionState === "connected" && call.status !== "in-progress") {
      call.status = "in-progress";
      void updateRun(call, "in-progress", {
        dummy_call_status: "in-progress",
        error: null,
      });
      void startGreeting(call);
    }

    if (
      ["failed", "closed", "disconnected"].includes(peerConnection.connectionState) &&
      !call.ended
    ) {
      void endCall(
        call,
        call.status === "in-progress" ? "failed" : "no-answer",
        "WebRTC connection ended",
      );
    }
  };

  call.peerConnection = peerConnection;
  call.audioSource = audioSource;
  call.audioTrack = audioTrack;
}

async function handleIncomingAudio(
  call: CallSession,
  data: {
    samples: Int16Array;
    sampleRate: number;
    channelCount: number;
    numberOfFrames: number;
  },
) {
  if (call.ended || call.assistantSpeaking || call.processingTurn) return;

  const monoSamples = mixToMono(data.samples, data.channelCount, data.numberOfFrames);
  const energy = estimateEnergy(monoSamples);
  const frameMs = (monoSamples.length / data.sampleRate) * 1000;

  if (energy >= VAD_THRESHOLD) {
    if (call.captureChunks.length === 0) {
      call.captureRate = data.sampleRate;
      call.awaitingSilenceMs = 0;
      call.utteranceMs = 0;
    }
    call.captureChunks.push(monoSamples);
    call.utteranceMs += frameMs;
    call.awaitingSilenceMs = 0;
  } else if (call.captureChunks.length > 0) {
    call.captureChunks.push(monoSamples);
    call.utteranceMs += frameMs;
    call.awaitingSilenceMs += frameMs;
  } else {
    return;
  }

  if (call.awaitingSilenceMs >= VAD_SILENCE_MS || call.utteranceMs >= VAD_MAX_UTTERANCE_MS) {
    const utterance = concatChunks(call.captureChunks);
    call.captureChunks = [];
    call.awaitingSilenceMs = 0;
    call.utteranceMs = 0;

    if (utterance.length < call.captureRate / 5) {
      return;
    }

    call.processingTurn = true;
    try {
      const resampled = resamplePcm16(utterance, call.captureRate, 24_000);
      const wavBytes = encodePcm16Wav(resampled, 24_000);
      const { transcript } = await transcribeAudio({
        audioBase64: bytesToBase64(wavBytes),
      });

      if (!transcript.trim()) return;

      await appendTurn(call, { role: "user", content: transcript });
      const reply = await generateAgentReply({
        ...call.flow,
        history: call.history,
        nextRole: "assistant",
      });
      await appendTurn(call, { role: "assistant", content: reply });
      const speech = await synthesizeSpeech({ text: reply });
      await streamAudioToCall(call, speech.audioBase64);
    } catch (error) {
      console.error("[dummy-phone-media] turn failed", error);
      await endCall(
        call,
        "failed",
        error instanceof Error ? error.message : "Turn processing failed",
      );
    } finally {
      call.processingTurn = false;
    }
  }
}

async function startGreeting(call: CallSession) {
  if (call.greetingStarted || call.ended) return;
  call.greetingStarted = true;

  try {
    const greeting = await generateAgentReply({
      ...call.flow,
      history: call.history,
      nextRole: "assistant",
    });
    await appendTurn(call, { role: "assistant", content: greeting });
    const speech = await synthesizeSpeech({ text: greeting });
    await streamAudioToCall(call, speech.audioBase64);
  } catch (error) {
    console.error("[dummy-phone-media] greeting failed", error);
    await endCall(call, "failed", error instanceof Error ? error.message : "Greeting failed");
  }
}

async function appendTurn(call: CallSession, turn: Turn) {
  call.history = [...call.history, turn];
  await supabaseAdmin
    .from("runs")
    .update({ transcript: buildTranscriptText(call.history) })
    .eq("id", call.runId);
}

async function streamAudioToCall(call: CallSession, audioBase64: string) {
  if (!call.audioSource || call.ended) return;

  call.assistantSpeaking = true;
  const { sampleRate, samples } = decodeWav(base64ToBytes(audioBase64));
  const resampled = resamplePcm16(samples, sampleRate, OUTBOUND_SAMPLE_RATE);

  for (let offset = 0; offset < resampled.length && !call.ended; offset += OUTBOUND_FRAME_SIZE) {
    const chunk = new Int16Array(OUTBOUND_FRAME_SIZE);
    chunk.set(resampled.subarray(offset, offset + OUTBOUND_FRAME_SIZE));
    call.audioSource.onData({
      samples: chunk,
      sampleRate: OUTBOUND_SAMPLE_RATE,
      bitsPerSample: 16,
      channelCount: 1,
      numberOfFrames: chunk.length,
    });
    await sleep(10);
  }

  for (let i = 0; i < 10 && !call.ended; i++) {
    call.audioSource.onData({
      samples: new Int16Array(OUTBOUND_FRAME_SIZE),
      sampleRate: OUTBOUND_SAMPLE_RATE,
      bitsPerSample: 16,
      channelCount: 1,
      numberOfFrames: OUTBOUND_FRAME_SIZE,
    });
    await sleep(10);
  }

  call.assistantSpeaking = false;
}

async function endCall(call: CallSession, status: DummyCallStatus, reason: string) {
  if (call.ended) return;
  call.ended = true;
  call.status = status;
  clearRingTimeout(call);

  call.audioSink?.stop();
  call.audioSink = null;
  call.audioTrack?.stop();
  call.audioTrack = null;
  call.peerConnection?.close();
  call.peerConnection = null;
  call.audioSource = null;

  callsById.delete(call.id);

  const patch: Record<string, string | null> = {
    dummy_call_status: status,
    error: status === "completed" ? null : reason,
  };

  if (["completed", "failed", "canceled", "no-answer"].includes(status)) {
    patch.completed_at = new Date().toISOString();
  }

  await updateRun(call, status, patch);

  if (call.handset.socket.readyState === WebSocket.OPEN) {
    send(call.handset.socket, {
      type: "call_ended",
      callId: call.id,
      reason,
    });
  }
}

async function updateRun(
  call: CallSession,
  status: DummyCallStatus,
  patch: Record<string, string | null>,
) {
  await supabaseAdmin
    .from("runs")
    .update({
      status: mapDummyStatusToRunStatus(status),
      ...patch,
    })
    .eq("id", call.runId);
}

function clearRingTimeout(call: CallSession) {
  if (call.ringTimeout) {
    clearTimeout(call.ringTimeout);
    call.ringTimeout = null;
  }
}

function send(socket: WebSocket, payload: unknown) {
  if (socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req: http.IncomingMessage) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function mixToMono(samples: Int16Array, channelCount: number, numberOfFrames: number) {
  if (channelCount <= 1) {
    return new Int16Array(samples);
  }

  const mono = new Int16Array(numberOfFrames);
  for (let frame = 0; frame < numberOfFrames; frame++) {
    let total = 0;
    for (let channel = 0; channel < channelCount; channel++) {
      total += samples[frame * channelCount + channel] || 0;
    }
    mono[frame] = Math.round(total / channelCount);
  }
  return mono;
}

function estimateEnergy(samples: Int16Array) {
  if (samples.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < samples.length; i++) {
    total += Math.abs(samples[i]);
  }
  return total / samples.length;
}

function concatChunks(chunks: Int16Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Int16Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function encodePcm16Wav(samples: Int16Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  let offset = 0;

  const writeAscii = (value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset++, value.charCodeAt(i));
    }
  };
  const writeU16 = (value: number) => {
    view.setUint16(offset, value, true);
    offset += 2;
  };
  const writeU32 = (value: number) => {
    view.setUint32(offset, value, true);
    offset += 4;
  };

  writeAscii("RIFF");
  writeU32(36 + samples.length * 2);
  writeAscii("WAVE");
  writeAscii("fmt ");
  writeU32(16);
  writeU16(1);
  writeU16(1);
  writeU32(sampleRate);
  writeU32(sampleRate * 2);
  writeU16(2);
  writeU16(16);
  writeAscii("data");
  writeU32(samples.length * 2);

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(offset, samples[i], true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}
