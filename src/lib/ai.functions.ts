import { createServerFn } from "@tanstack/react-start";
import {
  generateAgentReply,
  generateSalesReport,
  synthesizeSpeech,
  transcribeAudio,
} from "@/lib/conversation-core";

export const gradiumTTS = createServerFn({ method: "POST" })
  .inputValidator((data: { text: string; voiceId?: string }) => data)
  .handler(async ({ data }) => synthesizeSpeech(data));

export const gradiumSTT = createServerFn({ method: "POST" })
  .inputValidator((data: { audioBase64: string }) => data)
  .handler(async ({ data }) => transcribeAudio(data));

export const agentReply = createServerFn({ method: "POST" })
  .inputValidator((data: {
    whoWeAre: string;
    whatWeDo: string;
    persona: string;
    history: { role: "assistant" | "user"; content: string }[];
    nextRole: "assistant" | "user";
  }) => data)
  .handler(async ({ data }) => ({ text: await generateAgentReply(data) }));

export const generateReport = createServerFn({ method: "POST" })
  .inputValidator((data: { transcript: string }) => data)
  .handler(async ({ data }) => generateSalesReport(data));
