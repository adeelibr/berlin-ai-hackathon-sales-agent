import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { AppShell, AuthGuard } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Mic, MicOff, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { gradiumTTS, gradiumSTT, agentReply } from "@/lib/gradium.functions";
import { authHeaders } from "@/lib/server-fn-auth";

export const Route = createFileRoute("/conversations/$runId")({
  component: () => <AuthGuard><Conversation /></AuthGuard>,
});

type Turn = { role: "assistant" | "user"; content: string };
type Phase = "loading" | "ready" | "agent_speaking" | "listening" | "processing" | "ended";

function Conversation() {
  const { runId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("loading");
  const [history, setHistory] = useState<Turn[]>([]);
  const [flowCtx, setFlowCtx] = useState<{ whoWeAre: string; whatWeDo: string; persona: string; campaignId: string | null } | null>(null);
  const [personaId, setPersonaId] = useState<string | null>(null);
  const [chip, setChip] = useState<{ campaign: string; persona: string; lead: string }>({ campaign: "", persona: "", lead: "" });
  const [statusText, setStatusText] = useState("");

  const ttsFn = useServerFn(gradiumTTS);
  const sttFn = useServerFn(gradiumSTT);
  const aiFn = useServerFn(agentReply);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  // Load run + flow context
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: run, error: runErr } = await supabase
        .from("runs").select("flow_id, transcript, status, campaign_id, lead_id").eq("id", runId).maybeSingle();
      if (runErr || !run) { toast.error(runErr?.message ?? "Run not found"); return; }

      if (run.status === "completed") {
        // Already ended → bounce to read-only view
        navigate({ to: "/runs/$runId", params: { runId } });
        return;
      }

      const { data: flow, error: flowErr } = await supabase
        .from("flows").select("who_we_are, what_we_do, agent_persona").eq("id", run.flow_id).maybeSingle();
      if (flowErr) { toast.error(flowErr.message); return; }

      setFlowCtx({
        whoWeAre: flow?.who_we_are ?? "",
        whatWeDo: flow?.what_we_do ?? "",
        persona: flow?.agent_persona ?? "",
        campaignId: run.campaign_id ?? null,
      });

      // Hydrate chip labels (campaign · persona · lead)
      const [campRes, leadRes] = await Promise.all([
        run.campaign_id
          ? supabase.from("campaigns").select("name,persona_id").eq("id", run.campaign_id).maybeSingle()
          : Promise.resolve({ data: null } as const),
        run.lead_id
          ? supabase.from("leads").select("name,company").eq("id", run.lead_id).maybeSingle()
          : Promise.resolve({ data: null } as const),
      ]);
      let personaName = "";
      if (campRes.data?.persona_id) {
        const { data: p } = await supabase.from("sales_personas").select("name").eq("id", campRes.data.persona_id).maybeSingle();
        personaName = p?.name ?? "";
        setPersonaId(campRes.data.persona_id);
      }
      setChip({
        campaign: campRes.data?.name ?? "",
        persona: personaName,
        lead: leadRes.data ? `${leadRes.data.name}${leadRes.data.company ? ` · ${leadRes.data.company}` : ""}` : "",
      });

      setPhase("ready");
    })();
  }, [runId, user, navigate]);

  // Speak text via Gradium TTS, return when audio finishes playing
  const speak = useCallback(async (text: string) => {
    setPhase("agent_speaking");
    setStatusText("Agent speaking…");
    const { audioBase64, mime } = await ttsFn({
      data: { text, personaId: personaId ?? undefined },
      headers: await authHeaders(),
    });
    const bin = atob(audioBase64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve) => {
      const audio = new Audio(url);
      audioElRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
      audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      audio.play().catch(() => resolve());
    });
  }, [ttsFn, personaId]);

  // Append a turn locally + persist transcript
  const persistTurn = useCallback(async (turn: Turn, full: Turn[]) => {
    setHistory(full);
    const transcriptText = full.map((t) => `${t.role === "assistant" ? "Agent" : "You"}: ${t.content}`).join("\n");
    await supabase.from("runs").update({ transcript: transcriptText }).eq("id", runId);
  }, [runId]);

  // Agent's first greeting
  const startGreeting = useCallback(async () => {
    if (!flowCtx) return;
    try {
      const { text } = await aiFn({
        data: { ...flowCtx, history: [], nextRole: "assistant" },
        headers: await authHeaders(),
      });
      const turn: Turn = { role: "assistant", content: text };
      const next = [turn];
      await persistTurn(turn, next);
      await speak(text);
      setPhase("ready");
      setStatusText("Tap to talk");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Agent failed");
      setPhase("ready");
    }
  }, [flowCtx, aiFn, speak, persistTurn]);

  useEffect(() => {
    if (phase === "ready" && history.length === 0 && flowCtx) {
      startGreeting();
    }
  }, [phase, history.length, flowCtx, startGreeting]);

  // Start mic recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = rec;
      rec.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      rec.start();
      setPhase("listening");
      setStatusText("Listening…");
    } catch {
      toast.error("Microphone permission denied");
    }
  };

  // Convert webm/opus blob → 24 kHz mono WAV (what Gradium accepts)
  const blobToWav24k = async (blob: Blob): Promise<Blob> => {
    const arr = await blob.arrayBuffer();
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const decoded = await ctx.decodeAudioData(arr);
    // Resample to 24 kHz mono using OfflineAudioContext
    const targetRate = 24000;
    const targetLength = Math.ceil(decoded.duration * targetRate);
    const offline = new OfflineAudioContext(1, targetLength, targetRate);
    const src = offline.createBufferSource();
    // Mix down to mono
    const mono = offline.createBuffer(1, decoded.length, decoded.sampleRate);
    const monoData = mono.getChannelData(0);
    if (decoded.numberOfChannels === 1) {
      monoData.set(decoded.getChannelData(0));
    } else {
      const ch0 = decoded.getChannelData(0);
      const ch1 = decoded.getChannelData(1);
      for (let i = 0; i < decoded.length; i++) monoData[i] = (ch0[i] + ch1[i]) / 2;
    }
    src.buffer = mono;
    src.connect(offline.destination);
    src.start(0);
    const rendered = await offline.startRendering();
    ctx.close();

    // Encode to 16-bit PCM WAV
    const samples = rendered.getChannelData(0);
    const wavBuffer = encodeWav(samples, targetRate);
    return new Blob([wavBuffer], { type: "audio/wav" });
  };

  const stopAndSend = async () => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    setPhase("processing");
    setStatusText("Transcribing…");
    const stopped: Blob = await new Promise((resolve) => {
      rec.onstop = () => resolve(new Blob(audioChunksRef.current, { type: rec.mimeType || "audio/webm" }));
      rec.stop();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    console.info(`[conversation] recorded ${(stopped.size / 1024).toFixed(1)} KB (${stopped.type})`);

    try {
      const wav = await blobToWav24k(stopped);
      const wavBuf = new Uint8Array(await wav.arrayBuffer());
      console.info(`[conversation] WAV ready: ${(wavBuf.length / 1024).toFixed(1)} KB`);
      // base64 encode
      let bin = "";
      const C = 0x8000;
      for (let i = 0; i < wavBuf.length; i += C) bin += String.fromCharCode(...wavBuf.subarray(i, i + C));
      const audioBase64 = btoa(bin);

      const sttStart = performance.now();
      console.info("[conversation] → gradiumSTT");
      const sttResult = await sttFn({ data: { audioBase64 }, headers: await authHeaders() });
      console.info(`[conversation] ← gradiumSTT (${Math.round(performance.now() - sttStart)}ms)`, sttResult);
      if (sttResult.error) {
        console.error("[conversation] STT error:", sttResult.error);
        toast.error(sttResult.error);
        setPhase("ready");
        setStatusText("Tap to talk");
        return;
      }
      const transcript = sttResult.transcript;
      if (!transcript.trim()) {
        console.warn("[conversation] empty transcript");
        toast.message("Didn't catch that — try again");
        setPhase("ready");
        setStatusText("Tap to talk");
        return;
      }

      const userTurn: Turn = { role: "user", content: transcript };
      const afterUser = [...history, userTurn];
      await persistTurn(userTurn, afterUser);

      setStatusText("Agent thinking…");
      const aiStart = performance.now();
      console.info("[conversation] → agentReply");
      const { text: replyText } = await aiFn({
        data: { ...flowCtx!, history: afterUser, nextRole: "assistant" },
        headers: await authHeaders(),
      });
      console.info(`[conversation] ← agentReply (${Math.round(performance.now() - aiStart)}ms): "${replyText.slice(0, 80)}${replyText.length > 80 ? "…" : ""}"`);

      const agentTurn: Turn = { role: "assistant", content: replyText };
      const afterAgent = [...afterUser, agentTurn];
      await persistTurn(agentTurn, afterAgent);

      await speak(replyText);
      setPhase("ready");
      setStatusText("Tap to talk");
    } catch (e) {
      console.error("[conversation] stopAndSend failed:", e);
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      setPhase("ready");
      setStatusText("Tap to talk");
    }
  };

  const endConversation = async () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (audioElRef.current) try { audioElRef.current.pause(); } catch { /* noop */ }
    await supabase.from("runs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", runId);
    setPhase("ended");
    navigate({ to: "/runs/$runId", params: { runId } });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-8">
        <div className="flex items-center justify-between">
          <button onClick={endConversation} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> End & save
          </button>
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{statusText}</span>
        </div>

        {(chip.campaign || chip.persona || chip.lead) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {chip.campaign && <span className="rounded-full border border-border/60 bg-card/40 px-2.5 py-1">Campaign · {chip.campaign}</span>}
            <span className="rounded-full border border-border/60 bg-card/40 px-2.5 py-1">Voice{chip.persona ? ` · ${chip.persona}` : ""}</span>
            {chip.lead && <span className="rounded-full border border-border/60 bg-card/40 px-2.5 py-1">{chip.lead}</span>}
          </div>
        )}

        {/* Big mic */}
        <div className="mt-12 flex flex-col items-center">
          <div className={`relative flex h-48 w-48 items-center justify-center rounded-full border transition-all ${
            phase === "agent_speaking" ? "border-accent/60 bg-accent/10 zen-pulse"
            : phase === "listening" ? "border-destructive/60 bg-destructive/10"
            : phase === "processing" ? "border-muted bg-muted/30"
            : "border-border bg-card"
          }`}>
            {phase === "processing" ? (
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
            ) : phase === "listening" ? (
              <Mic className="h-14 w-14 text-destructive" />
            ) : phase === "agent_speaking" ? (
              <div className="h-14 w-14 rounded-full bg-accent/40" />
            ) : (
              <MicOff className="h-14 w-14 text-muted-foreground" />
            )}
          </div>

          <div className="mt-8 flex gap-3">
            {phase === "ready" && (
              <Button size="lg" onClick={startRecording} className="rounded-full px-8">
                <Mic className="h-4 w-4" /> Tap to talk
              </Button>
            )}
            {phase === "listening" && (
              <Button size="lg" variant="destructive" onClick={stopAndSend} className="rounded-full px-8">
                <Square className="h-4 w-4" /> Done
              </Button>
            )}
            {(phase === "agent_speaking" || phase === "processing" || phase === "loading") && (
              <Button size="lg" disabled className="rounded-full px-8">
                {phase === "loading" ? "Loading…" : phase === "processing" ? "Processing…" : "Agent speaking…"}
              </Button>
            )}
          </div>
        </div>

        {/* Transcript */}
        <div className="mt-16 space-y-3">
          {history.map((t, i) => (
            <div key={i} className={`rounded-xl border p-4 ${
              t.role === "assistant" ? "border-accent/30 bg-accent/5" : "border-border/60 bg-card/40"
            }`}>
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                {t.role === "assistant" ? "Agent" : "You"}
              </div>
              <p className="mt-1 text-sm leading-relaxed">{t.content}</p>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

// 16-bit PCM mono WAV encoder
function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;
  const writeStr = (s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i)); };
  const writeU32 = (v: number) => { view.setUint32(offset, v, true); offset += 4; };
  const writeU16 = (v: number) => { view.setUint16(offset, v, true); offset += 2; };
  writeStr("RIFF"); writeU32(36 + dataSize); writeStr("WAVE");
  writeStr("fmt "); writeU32(16); writeU16(1); writeU16(1);
  writeU32(sampleRate); writeU32(byteRate); writeU16(blockAlign); writeU16(16);
  writeStr("data"); writeU32(dataSize);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}