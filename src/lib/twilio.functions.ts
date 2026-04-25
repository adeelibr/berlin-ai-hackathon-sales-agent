import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createTwilioCall, mapTwilioStatusToRunStatus } from "@/lib/twilio";
import { logTwilio } from "@/lib/twilio-logging";

export const startTwilioCall = createServerFn({ method: "POST" })
  .inputValidator((data: { runId: string }) => data)
  .handler(async ({ data }) => {
    logTwilio("info", "start-call-fn:received", { runId: data.runId });
    const { data: run, error: runError } = await supabaseAdmin
      .from("runs")
      .select("id")
      .eq("id", data.runId)
      .maybeSingle();

    if (runError || !run) {
      logTwilio("error", "start-call-fn:run-missing", {
        runId: data.runId,
        error: runError?.message ?? "Run not found",
      });
      throw new Error(runError?.message ?? "Run not found");
    }

    try {
      const created = await createTwilioCall(data.runId);
      const nextStatus = mapTwilioStatusToRunStatus(created.twilioStatus);

      await supabaseAdmin
        .from("runs")
        .update({
          target_phone_number: created.toNumber,
          twilio_call_sid: created.callSid,
          twilio_call_status: created.twilioStatus,
          status: nextStatus,
          error: null,
        })
        .eq("id", data.runId);

      logTwilio("info", "start-call-fn:run-updated", {
        runId: data.runId,
        callSid: created.callSid,
        twilioStatus: created.twilioStatus,
        nextStatus,
        targetPhoneNumber: created.toNumber,
      });

      return {
        callSid: created.callSid,
        targetPhoneNumber: created.toNumber,
        status: nextStatus,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Twilio call creation failed";
      logTwilio("error", "start-call-fn:failed", {
        runId: data.runId,
        error: message,
      });
      await supabaseAdmin
        .from("runs")
        .update({
          status: "failed",
          error: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", data.runId);

      throw new Error(message);
    }
  });
