import {
  bytesToBase64,
  base64ToBytes,
  decodeWav,
  encodePcm16Wav,
  mulawBase64ToWavBase64,
  pcm16ToMuLaw,
  resamplePcm16,
  wavBase64ToMulawBase64,
} from "./audio-utils";

export type Turn = {
  role: "assistant" | "user";
  content: string;
};

export type FlowContext = {
  whoWeAre: string;
  whatWeDo: string;
  persona: string;
};

type OpenAIMessage = {
  role: "user" | "assistant";
  content: string;
};

type OpenAITextOptions = {
  apiKey: string;
  instructions: string;
  messages: OpenAIMessage[];
  temperature?: number;
  textFormat?:
    | {
        type: "text";
      }
    | {
        type: "json_schema";
        name: string;
        schema: Record<string, unknown>;
        strict?: boolean;
        description?: string;
      };
  maxOutputTokens?: number;
};

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const DEFAULT_GRADIUM_VOICE = "YTpq7expH9539ERJ";

export async function generateAgentReply(
  data: FlowContext & {
    history: Turn[];
    nextRole: "assistant" | "user";
  },
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const instructions = `You are a voice agent in a live spoken conversation.

About us:
${data.whoWeAre || "(not provided)"}

What we do:
${data.whatWeDo || "(not provided)"}

Your persona and instructions:
${data.persona || "Be warm, brief, conversational. Ask one question at a time."}

Rules:
- This is SPOKEN, not written. 1-3 short sentences max per turn.
- No markdown, no lists, no emoji. Plain prose only.
- No stage directions like *smiles*. Just say what you'd say out loud.
- If the user just joined and there is no prior turn, open with a warm greeting that introduces who we are in one sentence and asks an open question.`;

  const messages: OpenAIMessage[] =
    data.history.length === 0 && data.nextRole === "assistant"
      ? [{ role: "user", content: "(The user has just joined. Greet them.)" }]
      : data.history.map((message) => ({
          role: message.role,
          content: message.content,
        }));

  return generateOpenAIText({
    apiKey,
    instructions,
    messages,
    temperature: 0.7,
  });
}

export async function synthesizeSpeech(data: { text: string; voiceId?: string }) {
  const apiKey = process.env.GRADIUM_API_KEY;
  if (!apiKey) throw new Error("GRADIUM_API_KEY not configured");
  const voice = data.voiceId || DEFAULT_GRADIUM_VOICE;

  const res = await fetch("https://api.gradium.ai/api/post/speech/tts", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: data.text,
      voice_id: voice,
      output_format: "wav",
      only_audio: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gradium TTS error ${res.status}: ${text.slice(0, 200)}`);
  }

  return {
    audioBase64: bytesToBase64(new Uint8Array(await res.arrayBuffer())),
    mime: "audio/wav",
  };
}

export async function transcribeAudio(data: { audioBase64: string }) {
  const apiKey = process.env.GRADIUM_API_KEY;
  if (!apiKey) throw new Error("GRADIUM_API_KEY not configured");

  if (isNodeRuntime()) {
    return transcribeAudioInNode({ apiKey, audioBase64: data.audioBase64 });
  }

  const transcript = await new Promise<string>((resolve, reject) => {
    const parts: string[] = [];
    let settled = false;
    let ws: WebSocket | null = null;
    const finish = (err: Error | null) => {
      if (settled) return;
      settled = true;
      try {
        ws?.close();
      } catch {
        // ignore close errors
      }
      if (err) reject(err);
      else resolve(parts.join(" ").replace(/\s+/g, " ").trim());
    };

    const timeout = setTimeout(() => finish(new Error("STT timeout")), 60_000);

    (async () => {
      try {
        const upgradeRes = await fetch("https://api.gradium.ai/api/speech/asr", {
          headers: {
            Upgrade: "websocket",
            "x-api-key": apiKey,
          },
        });
        const sock = (upgradeRes as unknown as { webSocket?: WebSocket }).webSocket;
        if (!sock) {
          clearTimeout(timeout);
          finish(new Error(`Gradium WS handshake failed (${upgradeRes.status})`));
          return;
        }
        ws = sock;
        (sock as unknown as { accept: () => void }).accept();

        sock.addEventListener("message", (event: MessageEvent) => {
          const raw = typeof event.data === "string" ? event.data : "";
          if (!raw) return;
          let message: { type?: string; text?: string; message?: string };
          try {
            message = JSON.parse(raw);
          } catch {
            return;
          }
          if (message.type === "ready") {
            sock.send(JSON.stringify({ type: "audio", audio: data.audioBase64 }));
            sock.send(JSON.stringify({ type: "end_of_stream" }));
          } else if (message.type === "text" && typeof message.text === "string") {
            parts.push(message.text);
          } else if (message.type === "end_of_stream") {
            clearTimeout(timeout);
            finish(null);
          } else if (message.type === "error") {
            clearTimeout(timeout);
            finish(new Error(message.message || "Gradium STT error"));
          }
        });
        sock.addEventListener("close", () => {
          clearTimeout(timeout);
          finish(null);
        });
        sock.addEventListener("error", () => {
          clearTimeout(timeout);
          finish(new Error("Gradium WebSocket error"));
        });

        sock.send(JSON.stringify({ type: "setup", model_name: "default", input_format: "wav" }));
      } catch (error) {
        clearTimeout(timeout);
        finish(error instanceof Error ? error : new Error("Gradium WS connect failed"));
      }
    })();
  });

  return { transcript };
}

async function transcribeAudioInNode(data: { apiKey: string; audioBase64: string }) {
  const { default: NodeWebSocket } = await import("ws");
  const wsUrl = process.env.GRADIUM_ASR_WS_URL || "wss://api.gradium.ai/api/speech/asr";

  const transcript = await new Promise<string>((resolve, reject) => {
    const parts: string[] = [];
    let settled = false;
    let socket: InstanceType<typeof NodeWebSocket> | null = null;

    const finish = (err: Error | null) => {
      if (settled) return;
      settled = true;
      try {
        socket?.close();
      } catch {
        // ignore close errors
      }
      if (err) reject(err);
      else resolve(parts.join(" ").replace(/\s+/g, " ").trim());
    };

    const timeout = setTimeout(() => finish(new Error("STT timeout")), 60_000);

    try {
      socket = new NodeWebSocket(wsUrl, {
        headers: {
          "x-api-key": data.apiKey,
        },
      });

      socket.on("open", () => {
        socket?.send(JSON.stringify({ type: "setup", model_name: "default", input_format: "wav" }));
      });

      socket.on("message", (raw) => {
        const text = typeof raw === "string" ? raw : raw.toString("utf8");
        if (!text) return;

        let message: { type?: string; text?: string; message?: string };
        try {
          message = JSON.parse(text);
        } catch {
          return;
        }

        if (message.type === "ready") {
          socket?.send(JSON.stringify({ type: "audio", audio: data.audioBase64 }));
          socket?.send(JSON.stringify({ type: "end_of_stream" }));
        } else if (message.type === "text" && typeof message.text === "string") {
          parts.push(message.text);
        } else if (message.type === "end_of_stream") {
          clearTimeout(timeout);
          finish(null);
        } else if (message.type === "error") {
          clearTimeout(timeout);
          finish(new Error(message.message || "Gradium STT error"));
        }
      });

      socket.on("close", () => {
        clearTimeout(timeout);
        finish(null);
      });

      socket.on("error", (error) => {
        clearTimeout(timeout);
        finish(error instanceof Error ? error : new Error("Gradium WebSocket error"));
      });
    } catch (error) {
      clearTimeout(timeout);
      finish(error instanceof Error ? error : new Error("Gradium WS connect failed"));
    }
  });

  return { transcript };
}

export async function generateSalesReport(data: { transcript: string }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");
  if (!data.transcript?.trim()) throw new Error("Transcript is empty");

  const instructions =
    "You are a senior sales analyst. You are given a transcript of a spoken conversation between an AI agent and a prospect/customer. Produce a concise, structured report a Head of Sales can skim in 30 seconds. Be honest - if signal is weak, say so. Never invent facts not present in the transcript.";

  const responseSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      sentiment: { type: "string", enum: ["positive", "neutral", "negative", "mixed"] },
      intent_score: { type: "integer" },
      stage: {
        type: "string",
        enum: [
          "discovery",
          "qualification",
          "evaluation",
          "negotiation",
          "closed_won",
          "closed_lost",
          "no_fit",
          "unclear",
        ],
      },
      key_topics: { type: "array", items: { type: "string" } },
      pain_points: { type: "array", items: { type: "string" } },
      objections: { type: "array", items: { type: "string" } },
      opportunities: { type: "array", items: { type: "string" } },
      next_steps: { type: "array", items: { type: "string" } },
      risk_flags: { type: "array", items: { type: "string" } },
      quotable_moments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            quote: { type: "string" },
            why_it_matters: { type: "string" },
          },
          required: ["quote", "why_it_matters"],
        },
      },
    },
    required: [
      "summary",
      "sentiment",
      "intent_score",
      "stage",
      "key_topics",
      "pain_points",
      "objections",
      "opportunities",
      "next_steps",
      "risk_flags",
      "quotable_moments",
    ],
  };

  const text = await generateOpenAIText({
    apiKey,
    instructions,
    messages: [
      {
        role: "user",
        content: `Analyze this transcript and produce the structured sales report.\n\nTranscript:\n\n${data.transcript}`,
      },
    ],
    temperature: 0.4,
    textFormat: {
      type: "json_schema",
      name: "sales_report",
      schema: responseSchema,
      strict: true,
      description: "Structured sales call report for a head of sales.",
    },
  });

  try {
    return { reportJson: JSON.stringify(JSON.parse(text)) };
  } catch {
    throw new Error("OpenAI returned malformed JSON");
  }
}

export function buildTranscriptText(history: Turn[]) {
  return history
    .map((turn) => `${turn.role === "assistant" ? "Agent" : "You"}: ${turn.content}`)
    .join("\n");
}

export function parseTranscriptText(transcript: string | null | undefined): Turn[] {
  if (!transcript?.trim()) return [];

  return transcript
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap<Turn>((line) => {
      if (line.startsWith("Agent: ")) {
        return [{ role: "assistant", content: line.slice("Agent: ".length) }];
      }
      if (line.startsWith("You: ")) {
        return [{ role: "user", content: line.slice("You: ".length) }];
      }
      return [];
    });
}

export function mulawPayloadToGradiumWavBase64(mulawBase64: string) {
  return mulawBase64ToWavBase64(mulawBase64, 24000);
}

export function gradiumWavToTwilioMulawBase64(wavBase64: string) {
  return wavBase64ToMulawBase64(wavBase64);
}

export function rawMulawBytesToGradiumWavBase64(bytes: Uint8Array) {
  return mulawBase64ToWavBase64(bytesToBase64(bytes), 24000);
}

export function wavBytesToTwilioMulawBase64(bytes: Uint8Array) {
  const { sampleRate, samples } = decodeWav(bytes);
  const resampled = resamplePcm16(samples, sampleRate, 8000);
  return bytesToBase64(pcm16ToMuLaw(resampled));
}

export function pcm16ToWavBase64(samples: Int16Array, sampleRate: number) {
  return bytesToBase64(encodePcm16Wav(samples, sampleRate));
}

async function generateOpenAIText({
  apiKey,
  instructions,
  messages,
  temperature,
  textFormat,
  maxOutputTokens,
}: OpenAITextOptions) {
  const url = "https://api.openai.com/v1/responses";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions,
      input: messages.map((message) => buildOpenAIInputMessage(message)),
      temperature,
      max_output_tokens: maxOutputTokens,
      text: textFormat
        ? {
            format: textFormat,
          }
        : undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("OpenAI rate limit - try again shortly.");
    if (res.status === 401 || res.status === 403) {
      throw new Error("OpenAI API key invalid or lacks access.");
    }
    throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const text = extractOpenAIOutputText(json);

  if (!text) throw new Error("OpenAI returned no content");
  return text;
}

function extractOpenAIOutputText(json: unknown) {
  if (!json || typeof json !== "object") return "";
  const response = json as {
    output?: Array<{
      type?: string;
      content?: Array<{ type?: string; text?: string }>;
    }>;
  };

  return (
    response.output
      ?.flatMap((item) => (item.type === "message" ? (item.content ?? []) : []))
      .filter((contentItem) => contentItem.type === "output_text")
      .map((contentItem) => contentItem.text ?? "")
      .join("")
      .trim() ?? ""
  );
}

function isNodeRuntime() {
  return typeof process !== "undefined" && process.release?.name === "node";
}

function buildOpenAIInputMessage(message: OpenAIMessage) {
  return {
    type: "message",
    role: message.role,
    content: [
      message.role === "assistant"
        ? {
            type: "output_text" as const,
            text: message.content,
          }
        : {
            type: "input_text" as const,
            text: message.content,
          },
    ],
  };
}
