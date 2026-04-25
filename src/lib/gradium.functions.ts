import { createServerFn } from "@tanstack/react-start";

/**
 * Gradium TTS via REST: server-side call (keeps API key safe), returns base64 WAV.
 */
export const gradiumTTS = createServerFn({ method: "POST" })
  .inputValidator((data: { text: string; voiceId?: string }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.GRADIUM_API_KEY;
    if (!apiKey) throw new Error("GRADIUM_API_KEY not configured");
    const voice = data.voiceId || "YTpq7expH9539ERJ";

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
      const t = await res.text().catch(() => "");
      throw new Error(`Gradium TTS error ${res.status}: ${t.slice(0, 200)}`);
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    // base64 encode (chunked to avoid stack overflow on large buffers)
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < buf.length; i += chunk) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunk));
    }
    const audioBase64 = btoa(binary);
    return { audioBase64, mime: "audio/wav" };
  });

/**
 * Gradium STT via WebSocket: server opens a WS to Gradium with the API key,
 * streams the user-recorded WAV audio in, and collects the final transcript.
 * Browsers can't set custom WS headers, so this proxy lives on the server.
 */
export const gradiumSTT = createServerFn({ method: "POST" })
  .inputValidator((data: { audioBase64: string }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.GRADIUM_API_KEY;
    if (!apiKey) throw new Error("GRADIUM_API_KEY not configured");

    const transcript = await new Promise<string>((resolve, reject) => {
      // Cloudflare Workers WebSocket: pass headers via init
      let ws: WebSocket;
      try {
        // Cloudflare Workers' WebSocket constructor accepts an init object
        // with a `headers` field — TS doesn't know about it.
        const WSCtor = WebSocket as unknown as new (
          url: string,
          init?: { headers?: Record<string, string> }
        ) => WebSocket;
        ws = new WSCtor("wss://api.gradium.ai/api/speech/asr", {
          headers: { "x-api-key": apiKey },
        });
      } catch (e) {
        reject(e as Error);
        return;
      }

      const parts: string[] = [];
      let settled = false;
      const finish = (err: Error | null) => {
        if (settled) return;
        settled = true;
        try { ws.close(); } catch { /* ignore */ }
        if (err) reject(err);
        else resolve(parts.join(" ").replace(/\s+/g, " ").trim());
      };

      const timeout = setTimeout(() => finish(new Error("STT timeout")), 60_000);

      ws.addEventListener("open", () => {
        ws.send(JSON.stringify({ type: "setup", model_name: "default", input_format: "wav" }));
      });

      ws.addEventListener("message", (ev: MessageEvent) => {
        const raw = typeof ev.data === "string" ? ev.data : "";
        if (!raw) return;
        let msg: { type?: string; text?: string; message?: string };
        try { msg = JSON.parse(raw); } catch { return; }
        if (msg.type === "ready") {
          // Send the entire audio in one message, then end_of_stream
          ws.send(JSON.stringify({ type: "audio", audio: data.audioBase64 }));
          ws.send(JSON.stringify({ type: "end_of_stream" }));
        } else if (msg.type === "text" && typeof msg.text === "string") {
          parts.push(msg.text);
        } else if (msg.type === "end_of_stream") {
          clearTimeout(timeout);
          finish(null);
        } else if (msg.type === "error") {
          clearTimeout(timeout);
          finish(new Error(msg.message || "Gradium STT error"));
        }
      });

      ws.addEventListener("close", () => {
        clearTimeout(timeout);
        finish(null);
      });
      ws.addEventListener("error", () => {
        clearTimeout(timeout);
        finish(new Error("Gradium WebSocket error"));
      });
    });

    return { transcript };
  });

/**
 * Lovable AI agent reply.
 */
export const agentReply = createServerFn({ method: "POST" })
  .inputValidator((data: {
    whoWeAre: string;
    whatWeDo: string;
    persona: string;
    history: { role: "assistant" | "user"; content: string }[];
    nextRole: "assistant" | "user";
  }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const system = `You are a voice agent in a live spoken conversation.

About us:
${data.whoWeAre || "(not provided)"}

What we do:
${data.whatWeDo || "(not provided)"}

Your persona and instructions:
${data.persona || "Be warm, brief, conversational. Ask one question at a time."}

Rules:
- This is SPOKEN, not written. 1–3 short sentences max per turn.
- No markdown, no lists, no emoji. Plain prose only.
- No stage directions like *smiles*. Just say what you'd say out loud.
- If the user just joined and there is no prior turn, open with a warm greeting that introduces who we are in one sentence and asks an open question.`;

    const messages: { role: string; content: string }[] = [{ role: "system", content: system }];
    if (data.history.length === 0 && data.nextRole === "assistant") {
      messages.push({ role: "user", content: "(The user has just joined. Greet them.)" });
    } else {
      for (const m of data.history) messages.push(m);
    }

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limited — try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
      const t = await res.text().catch(() => "");
      throw new Error(`AI error ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = await res.json();
    const text: string = json?.choices?.[0]?.message?.content?.trim?.() ?? "";
    return { text };
  });