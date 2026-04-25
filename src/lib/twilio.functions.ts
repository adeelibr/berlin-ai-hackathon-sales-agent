import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getCallTargetNumber,
  getCallTransportMode,
  getDummyPhoneWebSocketBaseUrl,
  getPublicBaseUrl,
  type CallTransportMode,
} from "@/lib/call-config";
import { mapDummyStatusToRunStatus, startDummyCall } from "@/lib/dummy-phone";
import { createTwilioCall, mapTwilioStatusToRunStatus } from "@/lib/twilio";
import { logTwilio } from "@/lib/twilio-logging";

export const getCallRuntimeInfo = createServerFn({ method: "GET" }).handler(async () => {
  const mode = getCallTransportMode();
  const targetNumber = getCallTargetNumber();
  const publicBaseUrl = getPublicBaseUrl();

  return {
    mode,
    targetNumber,
    phoneDummyUrl:
      mode === "dummy" && publicBaseUrl
        ? `${publicBaseUrl}/phone-dummy/${encodeURIComponent(targetNumber)}`
        : null,
  };
});

export const getDummyPhoneClientConfig = createServerFn({ method: "GET" }).handler(async () => ({
  serviceWsBaseUrl: getDummyPhoneWebSocketBaseUrl(),
}));

export const startOutboundCall = createServerFn({ method: "POST" })
  .inputValidator((data: { runId: string }) => data)
  .handler(async ({ data }) => {
    const transport = getCallTransportMode();
    const targetNumber = getCallTargetNumber();
    logTwilio("info", "start-call-fn:received", {
      runId: data.runId,
      transport,
      targetNumber,
    });
    const { data: run, error: runError } = await supabaseAdmin
      .from("runs")
      .select("id, flow_id")
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
      if (transport === "dummy") {
        const { data: flow, error: flowError } = await supabaseAdmin
          .from("flows")
          .select("who_we_are, what_we_do, agent_persona")
          .eq("id", run.flow_id)
          .maybeSingle();

        if (flowError || !flow) {
          throw new Error(flowError?.message ?? "Flow not found");
        }

        const created = await startDummyCall({
          runId: data.runId,
          number: targetNumber,
          whoWeAre: flow.who_we_are,
          whatWeDo: flow.what_we_do,
          persona: flow.agent_persona,
        });
        const nextStatus = mapDummyStatusToRunStatus(created.status);

        await supabaseAdmin
          .from("runs")
          .update({
            call_transport: "dummy",
            target_phone_number: targetNumber,
            dummy_call_id: created.callId,
            dummy_call_status: created.status,
            dummy_device_session_id: created.sessionId,
            twilio_call_sid: null,
            twilio_call_status: null,
            twilio_stream_sid: null,
            status: nextStatus,
            error: null,
          })
          .eq("id", data.runId);

        return {
          transport,
          callId: created.callId,
          targetPhoneNumber: targetNumber,
          status: nextStatus,
        };
      }

      const created = await createTwilioCall(data.runId);
      const nextStatus = mapTwilioStatusToRunStatus(created.twilioStatus);

      await supabaseAdmin
        .from("runs")
        .update({
          call_transport: "twilio",
          target_phone_number: created.toNumber,
          twilio_call_sid: created.callSid,
          twilio_call_status: created.twilioStatus,
          dummy_call_id: null,
          dummy_call_status: null,
          dummy_device_session_id: null,
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
        transport,
        callSid: created.callSid,
        targetPhoneNumber: created.toNumber,
        status: nextStatus,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Twilio call creation failed";
      logTwilio("error", "start-call-fn:failed", {
        runId: data.runId,
        transport,
        error: message,
      });
      await supabaseAdmin
        .from("runs")
        .update({
          call_transport: transport as CallTransportMode,
          target_phone_number: targetNumber,
          status: "failed",
          error: message,
          completed_at: new Date().toISOString(),
        })
        .eq("id", data.runId);

      throw new Error(message);
    }
  });
