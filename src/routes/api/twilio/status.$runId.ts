import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  isTerminalTwilioStatus,
  mapTwilioStatusToRunStatus,
  toTwilioParamRecord,
  validateTwilioRequestSignature,
} from "@/lib/twilio";
import { logTwilio } from "@/lib/twilio-logging";

export const Route = createFileRoute("/api/twilio/status/$runId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const formData = await request.formData();
        const twilioParams = toTwilioParamRecord(formData);
        logTwilio("info", "status-webhook:received", {
          runId: params.runId,
          callSid: twilioParams.CallSid,
          callStatus: twilioParams.CallStatus,
          method: request.method,
          url: request.url,
        });
        const signatureValid = await validateTwilioRequestSignature(request, twilioParams);

        if (!signatureValid) {
          logTwilio("warn", "status-webhook:signature-rejected", {
            runId: params.runId,
            callSid: twilioParams.CallSid,
            callStatus: twilioParams.CallStatus,
          });
          return new Response("Invalid Twilio signature", { status: 403 });
        }

        const rawStatus = twilioParams.CallStatus || null;
        const patch: Record<string, string | null> = {
          twilio_call_sid: twilioParams.CallSid || null,
          twilio_call_status: rawStatus,
          status: mapTwilioStatusToRunStatus(rawStatus),
        };

        if (isTerminalTwilioStatus(rawStatus)) {
          patch.completed_at = new Date().toISOString();
          if (rawStatus && rawStatus !== "completed") {
            patch.error = `Twilio call ended with status: ${rawStatus}`;
          }
        }

        await supabaseAdmin
          .from("runs")
          .update(patch)
          .eq("id", params.runId);

        logTwilio("info", "status-webhook:run-updated", {
          runId: params.runId,
          callSid: twilioParams.CallSid,
          rawStatus,
          nextStatus: patch.status,
        });

        return new Response("ok", { status: 200 });
      },
    },
  },
});
