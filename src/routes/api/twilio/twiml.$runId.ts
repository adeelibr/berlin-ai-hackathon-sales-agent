import { createFileRoute } from "@tanstack/react-router";
import { buildTwimlStreamResponse, toTwilioParamRecord, validateTwilioRequestSignature } from "@/lib/twilio";
import { logTwilio } from "@/lib/twilio-logging";

async function buildTwimlResponse(request: Request, runId: string) {
  const params =
    request.method === "POST"
      ? toTwilioParamRecord(await request.clone().formData())
      : undefined;
  logTwilio("info", "twiml:request", {
    runId,
    method: request.method,
    url: request.url,
    callSid: params?.CallSid ?? null,
  });
  const signatureValid = await validateTwilioRequestSignature(request, params);

  if (!signatureValid) {
    logTwilio("warn", "twiml:signature-rejected", {
      runId,
      method: request.method,
      url: request.url,
      callSid: params?.CallSid ?? null,
    });
    return new Response("Invalid Twilio signature", { status: 403 });
  }

  logTwilio("info", "twiml:response", {
    runId,
    method: request.method,
    callSid: params?.CallSid ?? null,
  });
  return new Response(buildTwimlStreamResponse(runId), {
    status: 200,
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
    },
  });
}

export const Route = createFileRoute("/api/twilio/twiml/$runId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => buildTwimlResponse(request, params.runId),
      POST: async ({ request, params }) => buildTwimlResponse(request, params.runId),
    },
  },
});
