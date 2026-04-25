import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, Wifi, Loader2 } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { getDummyPhoneClientConfig } from "@/lib/twilio.functions";

export const Route = createFileRoute("/phone-dummy/$number")({
  component: DummyPhonePage,
});

type PhonePhase = "booting" | "idle" | "incoming" | "connecting" | "active";

type IncomingCall = {
  callId: string;
  callerLabel: string;
  number: string;
};

type SignalMessage =
  | { type: "registered"; number: string; sessionId: string }
  | { type: "incoming_call"; callId: string; callerLabel: string; number: string }
  | { type: "peer_answer"; callId: string; sdp: RTCSessionDescriptionInit }
  | { type: "peer_ice"; callId: string; candidate: RTCIceCandidateInit }
  | { type: "call_ended"; callId: string; reason?: string }
  | { type: "replaced"; reason?: string };

function DummyPhonePage() {
  const { number } = Route.useParams();
  const getClientConfig = useServerFn(getDummyPhoneClientConfig);

  const [phase, setPhase] = useState<PhonePhase>("booting");
  const [statusText, setStatusText] = useState("Connecting...");
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [registeredSession, setRegisteredSession] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const ringtoneRef = useRef<ReturnType<typeof createRingtoneController> | null>(null);
  const vibrateIntervalRef = useRef<number | null>(null);
  const currentCallIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string>("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    ringtoneRef.current = createRingtoneController();
    const unlock = () => {
      ringtoneRef.current?.prime().catch(() => {
        // Mobile browsers may still reject autoplay until another gesture.
      });
    };
    window.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("pointerdown", unlock, { passive: true });

    return () => {
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("pointerdown", unlock);
      stopIncomingAlerts(ringtoneRef, vibrateIntervalRef);
      cleanupMedia(peerConnectionRef, localStreamRef, remoteStreamRef, remoteAudioRef);
      wsRef.current?.close();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionIdRef.current = getOrCreateSessionId(number);
    setSessionReady(true);
  }, [number]);

  useEffect(() => {
    if (!callStartedAt) {
      setElapsedSeconds(0);
      return;
    }

    const interval = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - callStartedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [callStartedAt]);

  useEffect(() => {
    let cancelled = false;
    if (!sessionReady) return;

    (async () => {
      try {
        const { serviceWsBaseUrl } = await getClientConfig();
        if (cancelled) return;

        const url = new URL(`${serviceWsBaseUrl}/ws/phone-dummy`);
        url.searchParams.set("number", number);
        url.searchParams.set("sessionId", sessionIdRef.current);

        const ws = new WebSocket(url.toString());
        wsRef.current = ws;

        ws.addEventListener("open", () => {
          setStatusText("Waiting for a call...");
        });

        ws.addEventListener("message", async (event) => {
          const message = safeJsonParse<SignalMessage>(event.data);
          if (!message) return;

          if (message.type === "registered") {
            setRegisteredSession(message.sessionId);
            setPhase("idle");
            setStatusText("Ready to receive a demo call");
            return;
          }

          if (message.type === "incoming_call") {
            currentCallIdRef.current = message.callId;
            setIncomingCall({
              callId: message.callId,
              callerLabel: message.callerLabel,
              number: message.number,
            });
            setPhase("incoming");
            setStatusText("Incoming call");
            await startIncomingAlerts(ringtoneRef, vibrateIntervalRef);
            return;
          }

          if (message.type === "peer_answer") {
            await peerConnectionRef.current?.setRemoteDescription(message.sdp);
            return;
          }

          if (message.type === "peer_ice") {
            await peerConnectionRef.current?.addIceCandidate(message.candidate);
            return;
          }

          if (message.type === "call_ended") {
            stopIncomingAlerts(ringtoneRef, vibrateIntervalRef);
            cleanupMedia(peerConnectionRef, localStreamRef, remoteStreamRef, remoteAudioRef);
            setIncomingCall(null);
            currentCallIdRef.current = null;
            setCallStartedAt(null);
            setPhase("idle");
            setStatusText(message.reason || "Call ended");
            return;
          }

          if (message.type === "replaced") {
            stopIncomingAlerts(ringtoneRef, vibrateIntervalRef);
            cleanupMedia(peerConnectionRef, localStreamRef, remoteStreamRef, remoteAudioRef);
            setIncomingCall(null);
            currentCallIdRef.current = null;
            setCallStartedAt(null);
            setPhase("idle");
            setStatusText(message.reason || "This number is active in another tab");
            ws.close();
          }
        });

        ws.addEventListener("close", () => {
          if (!cancelled) {
            cleanupMedia(peerConnectionRef, localStreamRef, remoteStreamRef, remoteAudioRef);
            stopIncomingAlerts(ringtoneRef, vibrateIntervalRef);
            setCallStartedAt(null);
            setIncomingCall(null);
            setPhase("booting");
            setStatusText("Disconnected. Refresh to reconnect.");
          }
        });
      } catch (error) {
        setPhase("booting");
        setStatusText(
          error instanceof Error ? error.message : "Could not connect to dummy phone service",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getClientConfig, number, sessionReady]);

  useEffect(() => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.volume = speakerOn ? 1 : 0.55;
    }
  }, [speakerOn]);

  const acceptCall = async () => {
    const callId = currentCallIdRef.current;
    if (!callId || !wsRef.current) return;

    try {
      setPhase("connecting");
      setStatusText("Connecting...");
      stopIncomingAlerts(ringtoneRef, vibrateIntervalRef);

      const localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = localStream;

      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;

      const peerConnection = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      peerConnectionRef.current = peerConnection;

      peerConnection.ontrack = (event) => {
        remoteStream.addTrack(event.track);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(() => {
            // Audio may remain blocked until a gesture; the accept tap usually unlocks it.
          });
        }
      };

      peerConnection.onicecandidate = (event) => {
        if (!event.candidate || !wsRef.current) return;
        wsRef.current.send(
          JSON.stringify({
            type: "peer_ice",
            callId,
            candidate: event.candidate.toJSON(),
          }),
        );
      };

      peerConnection.onconnectionstatechange = () => {
        if (peerConnection.connectionState === "connected") {
          setPhase("active");
          setCallStartedAt(Date.now());
          setStatusText("Connected");
        } else if (["failed", "closed", "disconnected"].includes(peerConnection.connectionState)) {
          cleanupMedia(peerConnectionRef, localStreamRef, remoteStreamRef, remoteAudioRef);
          setCallStartedAt(null);
          setIncomingCall(null);
          currentCallIdRef.current = null;
          setPhase("idle");
          setStatusText("Connection lost");
        }
      };

      for (const track of localStream.getTracks()) {
        peerConnection.addTrack(track, localStream);
      }

      wsRef.current.send(
        JSON.stringify({
          type: "accept_call",
          callId,
        }),
      );

      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await peerConnection.setLocalDescription(offer);

      wsRef.current.send(
        JSON.stringify({
          type: "peer_offer",
          callId,
          sdp: offer,
        }),
      );
    } catch (error) {
      cleanupMedia(peerConnectionRef, localStreamRef, remoteStreamRef, remoteAudioRef);
      currentCallIdRef.current = callId;
      setPhase("incoming");
      setStatusText(error instanceof Error ? error.message : "Could not access the microphone");
      await startIncomingAlerts(ringtoneRef, vibrateIntervalRef);
    }
  };

  const declineCall = () => {
    const callId = currentCallIdRef.current;
    if (!callId || !wsRef.current) return;
    stopIncomingAlerts(ringtoneRef, vibrateIntervalRef);
    wsRef.current.send(JSON.stringify({ type: "decline_call", callId }));
    setIncomingCall(null);
    currentCallIdRef.current = null;
    setPhase("idle");
    setStatusText("Call declined");
  };

  const endCall = () => {
    const callId = currentCallIdRef.current;
    if (!callId || !wsRef.current) return;
    wsRef.current.send(JSON.stringify({ type: "hangup", callId }));
    cleanupMedia(peerConnectionRef, localStreamRef, remoteStreamRef, remoteAudioRef);
    setCallStartedAt(null);
    setIncomingCall(null);
    currentCallIdRef.current = null;
    setPhase("idle");
    setStatusText("Call ended");
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    for (const track of localStreamRef.current?.getAudioTracks() ?? []) {
      track.enabled = !next;
    }
    if (currentCallIdRef.current && wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: "mute_changed",
          callId: currentCallIdRef.current,
          muted: next,
        }),
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#0c111b] text-white">
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-safe">
        <div className="pt-6 text-center">
          <div className="text-xs uppercase tracking-[0.28em] text-white/45">Dummy phone</div>
          <div className="mt-2 font-display text-2xl">{formatDisplayNumber(number)}</div>
          <div className="mt-2 text-sm text-white/60">{statusText}</div>
          {registeredSession && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/65">
              <Wifi className="h-3.5 w-3.5" />
              Session {registeredSession.slice(0, 8)}
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          {phase === "booting" && (
            <div className="flex flex-col items-center">
              <div className="flex h-40 w-40 items-center justify-center rounded-full border border-white/10 bg-white/5">
                <Loader2 className="h-12 w-12 animate-spin text-white/65" />
              </div>
            </div>
          )}

          {phase === "idle" && (
            <div className="flex flex-col items-center">
              <div className="flex h-48 w-48 items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,#1d3a63,#0b1321)] shadow-[0_0_80px_rgba(29,58,99,0.35)]">
                <Phone className="h-14 w-14 text-white/85" />
              </div>
              <p className="mt-8 max-w-xs text-center text-sm leading-relaxed text-white/60">
                Keep this page open on your phone. When the workflow calls{" "}
                <span className="font-mono text-white/90">{number}</span>, this page will ring and
                let you talk to the agent.
              </p>
            </div>
          )}

          {(phase === "incoming" || phase === "connecting" || phase === "active") && (
            <div className="w-full text-center">
              <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-full border border-white/10 bg-[radial-gradient(circle_at_top,#385c8a,#0b1321)] shadow-[0_0_100px_rgba(68,120,189,0.28)]">
                <Phone className="h-16 w-16 text-white/90" />
              </div>
              <div className="mt-8 text-3xl font-display">
                {incomingCall?.callerLabel ?? "Stillwater Demo"}
              </div>
              <div className="mt-2 text-base text-white/60">
                {incomingCall?.number ?? formatDisplayNumber(number)}
              </div>
              {phase === "active" && (
                <div className="mt-4 text-sm tracking-[0.18em] text-white/55">
                  {formatElapsed(elapsedSeconds)}
                </div>
              )}
            </div>
          )}
        </div>

        {phase === "incoming" && (
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={declineCall}
              className="h-16 flex-1 rounded-full border-red-400/30 bg-red-500/15 text-white hover:bg-red-500/20"
            >
              <PhoneOff className="h-5 w-5" />
              Decline
            </Button>
            <Button
              onClick={acceptCall}
              className="h-16 flex-1 rounded-full bg-emerald-500 text-black hover:bg-emerald-400"
            >
              <Phone className="h-5 w-5" />
              Accept
            </Button>
          </div>
        )}

        {phase === "connecting" && (
          <Button
            disabled
            className="h-16 w-full rounded-full bg-white/10 text-white/80 hover:bg-white/10"
          >
            <Loader2 className="h-5 w-5 animate-spin" />
            Connecting...
          </Button>
        )}

        {phase === "active" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Button
                variant="outline"
                onClick={toggleMute}
                className="h-16 rounded-3xl border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                {isMuted ? "Muted" : "Mute"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setSpeakerOn((value) => !value)}
                className="h-16 rounded-3xl border-white/10 bg-white/5 text-white hover:bg-white/10"
              >
                <Volume2 className="h-5 w-5" />
                {speakerOn ? "Speaker" : "Quiet"}
              </Button>
            </div>
            <Button
              onClick={endCall}
              className="h-16 w-full rounded-full bg-red-500 text-white hover:bg-red-400"
            >
              <PhoneOff className="h-5 w-5" />
              End call
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function getOrCreateSessionId(number: string) {
  const key = `dummy-phone-session:${number}`;
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = window.crypto.randomUUID();
  window.sessionStorage.setItem(key, created);
  return created;
}

function safeJsonParse<T>(value: string | Blob | ArrayBuffer | ArrayBufferView): T | null {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function cleanupMedia(
  peerConnectionRef: MutableRefObject<RTCPeerConnection | null>,
  localStreamRef: MutableRefObject<MediaStream | null>,
  remoteStreamRef: MutableRefObject<MediaStream | null>,
  remoteAudioRef?: MutableRefObject<HTMLAudioElement | null>,
) {
  peerConnectionRef.current?.close();
  peerConnectionRef.current = null;
  localStreamRef.current?.getTracks().forEach((track) => track.stop());
  localStreamRef.current = null;
  remoteStreamRef.current?.getTracks().forEach((track) => track.stop());
  remoteStreamRef.current = null;
  if (remoteAudioRef?.current) {
    remoteAudioRef.current.pause();
    remoteAudioRef.current.srcObject = null;
  }
}

async function startIncomingAlerts(
  ringtoneRef: MutableRefObject<ReturnType<typeof createRingtoneController> | null>,
  vibrateIntervalRef: MutableRefObject<number | null>,
) {
  await ringtoneRef.current?.start();
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([250, 120, 250, 120, 250]);
    vibrateIntervalRef.current = window.setInterval(() => {
      navigator.vibrate([250, 120, 250, 120, 250]);
    }, 1900);
  }
}

function stopIncomingAlerts(
  ringtoneRef: MutableRefObject<ReturnType<typeof createRingtoneController> | null>,
  vibrateIntervalRef: MutableRefObject<number | null>,
) {
  ringtoneRef.current?.stop();
  if (vibrateIntervalRef.current) {
    window.clearInterval(vibrateIntervalRef.current);
    vibrateIntervalRef.current = null;
  }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(0);
  }
}

function createRingtoneController() {
  let context: AudioContext | null = null;
  let intervalId: number | null = null;

  const ensureContext = async () => {
    if (!context) {
      const AudioCtor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) return null;
      context = new AudioCtor();
    }
    if (context.state === "suspended") {
      await context.resume();
    }
    return context;
  };

  const playBurst = async () => {
    const ctx = await ensureContext();
    if (!ctx) return;
    const duration = 0.22;
    const now = ctx.currentTime;
    for (const [index, frequency] of [660, 880].entries()) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = frequency;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const startAt = now + index * 0.32;
      gain.gain.exponentialRampToValueAtTime(0.08, startAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      osc.start(startAt);
      osc.stop(startAt + duration);
    }
  };

  return {
    prime: ensureContext,
    start: async () => {
      await playBurst();
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      intervalId = window.setInterval(() => {
        playBurst().catch(() => {
          // ignore autoplay rejections
        });
      }, 1800);
    },
    stop: () => {
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    },
  };
}

function formatDisplayNumber(number: string) {
  if (number.startsWith("+")) return number;
  return number.replace(/(.{3})/g, "$1 ").trim();
}

function formatElapsed(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
