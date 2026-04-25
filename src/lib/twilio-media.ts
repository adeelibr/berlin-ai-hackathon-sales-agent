import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  buildTranscriptText,
  generateAgentReply,
  gradiumWavToTwilioMulawBase64,
  parseTranscriptText,
  rawMulawBytesToGradiumWavBase64,
  synthesizeSpeech,
  transcribeAudio,
  type FlowContext,
  type Turn,
} from "@/lib/conversation-core";
import { base64ToBytes, concatUint8Arrays, estimateMuLawEnergy } from "@/lib/audio-utils";
import { endTwilioCall, validateTwilioRequestSignature } from "@/lib/twilio";
import { logTwilio } from "@/lib/twilio-logging";

const SPEECH_ENERGY_THRESHOLD = 900;
const MIN_SPEECH_FRAMES = 4;
const SILENCE_FRAME_THRESHOLD = 15;
const MAX_FRAMES_PER_UTTERANCE = 400;

type TwilioStartMessage = {
  event: "start";
  start: {
    callSid: string;
    streamSid: string;
    customParameters?: Record<string, string>;
  };
  streamSid: string;
};

type TwilioMediaMessage = {
  event: "media";
  media: {
    payload: string;
  };
  streamSid: string;
};

type TwilioMarkMessage = {
  event: "mark";
  mark?: {
    name?: string;
  };
  streamSid: string;
};

type TwilioStopMessage = {
  event: "stop";
  streamSid: string;
};

type ConversationState = {
  runId: string | null;
  callSid: string | null;
  streamSid: string | null;
  flow: FlowContext | null;
  history: Turn[];
  listening: boolean;
  processing: boolean;
  pendingMark: string | null;
  speechActive: boolean;
  speechChunks: Uint8Array[];
  speechFrameCount: number;
  silenceFrames: number;
  finalized: boolean;
};

export async function handleTwilioMediaStream(request: Request) {
  logTwilio("info", "media-stream:connect-attempt", {
    url: request.url,
    method: request.method,
    userAgent: request.headers.get("user-agent"),
  });
  const signatureValid = await validateTwilioRequestSignature(request);
  if (!signatureValid) {
    logTwilio("warn", "media-stream:signature-rejected", {
      url: request.url,
    });
    return new Response("Invalid Twilio signature", { status: 403 });
  }

  const upgradeHeader = request.headers.get("Upgrade");
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
    return new Response("Expected websocket upgrade", { status: 426 });
  }

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();

  const state: ConversationState = {
    runId: null,
    callSid: null,
    streamSid: null,
    flow: null,
    history: [],
    listening: false,
    processing: false,
    pendingMark: null,
    speechActive: false,
    speechChunks: [],
    speechFrameCount: 0,
    silenceFrames: 0,
    finalized: false,
  };

  const safeHandleError = async (error: unknown) => {
    const message = error instanceof Error ? error.message : "Twilio media stream failed";
    logTwilio("error", "media-stream:error", {
      runId: state.runId,
      callSid: state.callSid,
      streamSid: state.streamSid,
      error: message,
    });
    await finalizeRun(state, "failed", message);
    if (state.callSid) {
      await endTwilioCall(state.callSid);
    }
    try {
      server.close(1011, "stream error");
    } catch {
      // ignore close failures
    }
  };

  server.addEventListener("message", (event) => {
    const raw = typeof event.data === "string" ? event.data : "";
    if (!raw) return;

    void (async () => {
      const message = JSON.parse(raw) as
        | TwilioStartMessage
        | TwilioMediaMessage
        | TwilioMarkMessage
        | TwilioStopMessage
        | { event?: string };

      switch (message.event) {
        case "start":
          await handleStartMessage(server, state, message);
          break;
        case "media":
          await handleMediaMessage(server, state, message);
          break;
        case "mark":
          handleMarkMessage(state, message);
          break;
        case "stop":
          await handleStopMessage(state);
          break;
        default:
          break;
      }
    })().catch((error) => {
      void safeHandleError(error);
    });
  });

  server.addEventListener("close", () => {
    logTwilio("info", "media-stream:closed", {
      runId: state.runId,
      callSid: state.callSid,
      streamSid: state.streamSid,
      finalized: state.finalized,
    });
    void finalizeRun(state, null, null);
  });
  server.addEventListener("error", () => {
    void safeHandleError(new Error("Twilio websocket error"));
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  } as ResponseInit & { webSocket: WebSocket });
}

async function handleStartMessage(server: WebSocket, state: ConversationState, message: TwilioStartMessage) {
  const runId = message.start.customParameters?.runId;
  if (!runId) {
    throw new Error("Missing runId in Twilio stream parameters");
  }

  const { data: run, error: runError } = await supabaseAdmin
    .from("runs")
    .select("flow_id, transcript")
    .eq("id", runId)
    .maybeSingle();

  if (runError || !run) {
    throw new Error(runError?.message ?? "Run not found");
  }

  const { data: flow, error: flowError } = await supabaseAdmin
    .from("flows")
    .select("who_we_are, what_we_do, agent_persona")
    .eq("id", run.flow_id)
    .maybeSingle();

  if (flowError || !flow) {
    throw new Error(flowError?.message ?? "Flow not found");
  }

  state.runId = runId;
  state.callSid = message.start.callSid;
  state.streamSid = message.start.streamSid;
  state.flow = {
    whoWeAre: flow.who_we_are,
    whatWeDo: flow.what_we_do,
    persona: flow.agent_persona,
  };
  state.history = parseTranscriptText(run.transcript);

  logTwilio("info", "media-stream:start", {
    runId,
    callSid: message.start.callSid,
    streamSid: message.start.streamSid,
    priorTurns: state.history.length,
  });

  await supabaseAdmin
    .from("runs")
    .update({
      twilio_call_sid: message.start.callSid,
      twilio_stream_sid: message.start.streamSid,
      status: "in_progress",
      twilio_call_status: "in-progress",
      error: null,
    })
    .eq("id", runId);

  if (state.history.length === 0) {
    logTwilio("info", "media-stream:generate-greeting", {
      runId,
      callSid: state.callSid,
      streamSid: state.streamSid,
    });
    const greeting = await generateAgentReply({
      ...state.flow,
      history: [],
      nextRole: "assistant",
    });
    state.history = [...state.history, { role: "assistant", content: greeting }];
    await persistHistory(state);
    await playAgentText(server, state, greeting);
  } else {
    logTwilio("info", "media-stream:resume-history", {
      runId,
      callSid: state.callSid,
      streamSid: state.streamSid,
      priorTurns: state.history.length,
    });
    state.listening = true;
  }
}

async function handleMediaMessage(server: WebSocket, state: ConversationState, message: TwilioMediaMessage) {
  if (!state.runId || !state.listening || state.processing) return;

  const bytes = base64ToBytes(message.media.payload);
  const energy = estimateMuLawEnergy(bytes);

  if (state.speechActive) {
    state.speechChunks.push(bytes);
    state.speechFrameCount += 1;

    if (energy > SPEECH_ENERGY_THRESHOLD) {
      state.silenceFrames = 0;
    } else {
      state.silenceFrames += 1;
    }

    if (
      state.speechFrameCount >= MAX_FRAMES_PER_UTTERANCE ||
      (state.speechFrameCount >= MIN_SPEECH_FRAMES && state.silenceFrames >= SILENCE_FRAME_THRESHOLD)
    ) {
      const utterance = concatUint8Arrays(state.speechChunks);
      logTwilio("info", "media-stream:utterance-detected", {
        runId: state.runId,
        callSid: state.callSid,
        streamSid: state.streamSid,
        frameCount: state.speechFrameCount,
        byteLength: utterance.length,
      });
      resetSpeechBuffer(state);
      state.processing = true;
      state.listening = false;

      await processCallerUtterance(server, state, utterance);
    }

    return;
  }

  if (energy > SPEECH_ENERGY_THRESHOLD) {
    state.speechActive = true;
    state.speechChunks = [bytes];
    state.speechFrameCount = 1;
    state.silenceFrames = 0;
  }
}

function handleMarkMessage(state: ConversationState, message: TwilioMarkMessage) {
  if (!state.pendingMark || message.mark?.name !== state.pendingMark) return;
  logTwilio("info", "media-stream:playback-complete", {
    runId: state.runId,
    callSid: state.callSid,
    streamSid: state.streamSid,
    markName: message.mark?.name,
  });
  state.pendingMark = null;
  state.processing = false;
  state.listening = true;
}

async function handleStopMessage(state: ConversationState) {
  logTwilio("info", "media-stream:stop", {
    runId: state.runId,
    callSid: state.callSid,
    streamSid: state.streamSid,
  });
  await finalizeRun(state, state.finalized ? null : "completed", null);
}

async function processCallerUtterance(server: WebSocket, state: ConversationState, utterance: Uint8Array) {
  try {
    logTwilio("info", "media-stream:transcribe-start", {
      runId: state.runId,
      callSid: state.callSid,
      streamSid: state.streamSid,
      byteLength: utterance.length,
    });
    const { transcript } = await transcribeAudio({
      audioBase64: rawMulawBytesToGradiumWavBase64(utterance),
    });

    if (!transcript.trim()) {
      logTwilio("info", "media-stream:transcribe-empty", {
        runId: state.runId,
        callSid: state.callSid,
        streamSid: state.streamSid,
      });
      state.processing = false;
      state.listening = true;
      return;
    }

    logTwilio("info", "media-stream:transcribe-success", {
      runId: state.runId,
      callSid: state.callSid,
      streamSid: state.streamSid,
      transcriptPreview: transcript.slice(0, 120),
    });

    state.history = [...state.history, { role: "user", content: transcript }];
    await persistHistory(state);

    const reply = await generateAgentReply({
      ...(state.flow as FlowContext),
      history: state.history,
      nextRole: "assistant",
    });

    logTwilio("info", "media-stream:reply-generated", {
      runId: state.runId,
      callSid: state.callSid,
      streamSid: state.streamSid,
      replyPreview: reply.slice(0, 120),
      turnCount: state.history.length,
    });

    state.history = [...state.history, { role: "assistant", content: reply }];
    await persistHistory(state);
    await playAgentText(server, state, reply);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Provider failure during phone conversation";
    await finalizeRun(state, "failed", message);
    if (state.callSid) {
      await endTwilioCall(state.callSid);
    }
    throw error;
  }
}

async function playAgentText(server: WebSocket, state: ConversationState, text: string) {
  const { audioBase64 } = await synthesizeSpeech({ text });
  const payload = gradiumWavToTwilioMulawBase64(audioBase64);
  const markName = `mark-${Date.now()}`;

  logTwilio("info", "media-stream:play-agent-text", {
    runId: state.runId,
    callSid: state.callSid,
    streamSid: state.streamSid,
    textPreview: text.slice(0, 120),
    outputBytes: payload.length,
    markName,
  });

  state.pendingMark = markName;
  state.listening = false;

  server.send(JSON.stringify({
    event: "media",
    streamSid: state.streamSid,
    media: {
      payload,
    },
  }));
  server.send(JSON.stringify({
    event: "mark",
    streamSid: state.streamSid,
    mark: {
      name: markName,
    },
  }));
}

async function persistHistory(state: ConversationState) {
  if (!state.runId) return;

  await supabaseAdmin
    .from("runs")
    .update({ transcript: buildTranscriptText(state.history) })
    .eq("id", state.runId);

  logTwilio("info", "media-stream:transcript-persisted", {
    runId: state.runId,
    callSid: state.callSid,
    streamSid: state.streamSid,
    turnCount: state.history.length,
  });
}

async function finalizeRun(state: ConversationState, nextStatus: string | null, error: string | null) {
  if (!state.runId || state.finalized) return;
  state.finalized = true;

  const patch: Record<string, string | null> = {};
  if (nextStatus) {
    patch.status = nextStatus;
    patch.twilio_call_status = nextStatus === "in_progress" ? "in-progress" : nextStatus.replaceAll("_", "-");
  }
  if (error) {
    patch.error = error;
  }
  if (!nextStatus || ["completed", "failed", "busy", "no_answer", "canceled"].includes(nextStatus)) {
    patch.completed_at = new Date().toISOString();
  }

  await supabaseAdmin
    .from("runs")
    .update(patch)
    .eq("id", state.runId);

  logTwilio("info", "media-stream:run-finalized", {
    runId: state.runId,
    callSid: state.callSid,
    streamSid: state.streamSid,
    nextStatus,
    error,
  });
}

function resetSpeechBuffer(state: ConversationState) {
  state.speechActive = false;
  state.speechChunks = [];
  state.speechFrameCount = 0;
  state.silenceFrames = 0;
}
