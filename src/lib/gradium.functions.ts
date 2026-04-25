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
      const parts: string[] = [];
      let settled = false;
      let ws: WebSocket | null = null;
      const finish = (err: Error | null) => {
        if (settled) return;
        settled = true;
        try { ws?.close(); } catch { /* ignore */ }
        if (err) reject(err);
        else resolve(parts.join(" ").replace(/\s+/g, " ").trim());
      };

      const timeout = setTimeout(() => finish(new Error("STT timeout")), 60_000);

      // Cloudflare Workers requires using fetch() with Upgrade: websocket
      // to attach custom headers like x-api-key on the WS handshake.
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

          sock.addEventListener("message", (ev: MessageEvent) => {
            const raw = typeof ev.data === "string" ? ev.data : "";
            if (!raw) return;
            let msg: { type?: string; text?: string; message?: string };
            try { msg = JSON.parse(raw); } catch { return; }
            if (msg.type === "ready") {
              sock.send(JSON.stringify({ type: "audio", audio: data.audioBase64 }));
              sock.send(JSON.stringify({ type: "end_of_stream" }));
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
          sock.addEventListener("close", () => {
            clearTimeout(timeout);
            finish(null);
          });
          sock.addEventListener("error", () => {
            clearTimeout(timeout);
            finish(new Error("Gradium WebSocket error"));
          });

          // Send setup once the socket is accepted
          sock.send(JSON.stringify({ type: "setup", model_name: "default", input_format: "wav" }));
        } catch (e) {
          clearTimeout(timeout);
          finish(e instanceof Error ? e : new Error("Gradium WS connect failed"));
        }
      })();
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

/**
 * Generate a structured sales-readable report from a conversation transcript.
 * Uses Lovable AI (Gemini) with tool calling for guaranteed JSON shape.
 */
export const generateReport = createServerFn({ method: "POST" })
  .inputValidator((data: { transcript: string }) => data)
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
    if (!data.transcript?.trim()) throw new Error("Transcript is empty");

    const system = `You are a senior sales analyst. You are given a transcript of a spoken conversation between an AI agent and a prospect/customer. Produce a concise, structured report a Head of Sales can skim in 30 seconds. Be honest — if signal is weak, say so. Never invent facts not present in the transcript.`;

    const userPrompt = `Transcript:\n\n${data.transcript}\n\nAnalyze this conversation and call the build_sales_report tool with the structured analysis.`;

    const tool = {
      type: "function",
      function: {
        name: "build_sales_report",
        description: "Return a structured sales report for the conversation.",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string", description: "2-3 sentence executive summary of what happened in the call." },
            sentiment: { type: "string", enum: ["positive", "neutral", "negative", "mixed"], description: "Overall prospect sentiment." },
            intent_score: { type: "integer", minimum: 0, maximum: 10, description: "Buying intent from 0 (none) to 10 (ready to buy)." },
            stage: { type: "string", enum: ["discovery", "qualification", "evaluation", "negotiation", "closed_won", "closed_lost", "no_fit", "unclear"], description: "Where in the sales process this conversation sits." },
            key_topics: { type: "array", items: { type: "string" }, description: "3-6 main topics/themes discussed." },
            pain_points: { type: "array", items: { type: "string" }, description: "Pain points or problems the prospect mentioned." },
            objections: { type: "array", items: { type: "string" }, description: "Concerns/objections raised." },
            opportunities: { type: "array", items: { type: "string" }, description: "Opportunities or buying signals." },
            next_steps: { type: "array", items: { type: "string" }, description: "Recommended next actions for the sales team." },
            risk_flags: { type: "array", items: { type: "string" }, description: "Red flags or risks worth flagging (e.g. budget unclear, ghosting risk)." },
            quotable_moments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  quote: { type: "string" },
                  why_it_matters: { type: "string" },
                },
                required: ["quote", "why_it_matters"],
                additionalProperties: false,
              },
              description: "1-3 standout quotes from the prospect with brief context.",
            },
          },
          required: ["summary", "sentiment", "intent_score", "stage", "key_topics", "pain_points", "objections", "opportunities", "next_steps", "risk_flags", "quotable_moments"],
          additionalProperties: false,
        },
      },
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: system },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "build_sales_report" } },
      }),
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("Rate limited — try again shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add funds in Settings → Workspace → Usage.");
      const t = await res.text().catch(() => "");
      throw new Error(`AI error ${res.status}: ${t.slice(0, 200)}`);
    }
    const json = await res.json();
    const call = json?.choices?.[0]?.message?.tool_calls?.[0];
    const argsStr: string = call?.function?.arguments ?? "{}";
    let report: Record<string, unknown>;
    try { report = JSON.parse(argsStr); } catch { throw new Error("AI returned malformed report"); }
    return { report };
  });