import twilio from "twilio";

import { getCallTargetNumber, getTwilioMediaStreamWebSocketBaseUrl } from "@/lib/call-config";
import { createTwilioStreamToken } from "@/lib/twilio-stream-auth";
import { logTwilio, maskAccountSid, maskPhoneNumber } from "@/lib/twilio-logging";

const TERMINAL_TWILIO_STATUSES = new Set(["completed", "busy", "failed", "no-answer", "canceled"]);

export function getTwilioConfig() {
  const accountSid = getRequiredEnv("TWILIO_ACCOUNT_SID");
  const authToken = getRequiredEnv("TWILIO_AUTH_TOKEN");
  const fromNumber = getRequiredEnv("TWILIO_FROM_NUMBER");
  const toNumber = getCallTargetNumber();
  const publicBaseUrl = getRequiredEnv("PUBLIC_BASE_URL").replace(/\/$/, "");

  return {
    accountSid,
    authToken,
    fromNumber,
    toNumber,
    publicBaseUrl,
    mediaStreamUrl: getTwilioMediaStreamWebSocketBaseUrl(),
  };
}

export async function createTwilioCall(runId: string) {
  const config = getTwilioConfig();
  const twimlUrl = `${config.publicBaseUrl}/api/twilio/twiml/${runId}`;
  const statusUrl = `${config.publicBaseUrl}/api/twilio/status/${runId}`;

  logTwilio("info", "create-call:start", {
    runId,
    accountSid: config.accountSid,
    fromPhone: config.fromNumber,
    toPhone: config.toNumber,
    twimlUrl,
    statusUrl,
    httpMethod: "GET",
  });

  await logTwilioNumberOwnership(config);

  const params = new URLSearchParams();
  params.set("To", config.toNumber);
  params.set("From", config.fromNumber);
  params.set("Url", twimlUrl);
  params.set("Method", "GET");
  params.set("StatusCallback", statusUrl);
  params.set("StatusCallbackMethod", "POST");
  params.append("StatusCallbackEvent", "initiated");
  params.append("StatusCallbackEvent", "ringing");
  params.append("StatusCallbackEvent", "answered");
  params.append("StatusCallbackEvent", "completed");

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${encodeBase64(`${config.accountSid}:${config.authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: params.toString(),
    },
  );

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    logTwilio("error", "create-call:failed", {
      runId,
      responseStatus: res.status,
      responseStatusText: res.statusText,
      twilioCode: json?.code,
      twilioMessage: json?.message,
      moreInfo: json?.more_info,
      fromPhone: config.fromNumber,
      toPhone: config.toNumber,
      accountSid: config.accountSid,
    });
    const message =
      typeof json?.message === "string"
        ? json.message
        : `Twilio call creation failed (${res.status})`;
    throw new Error(message);
  }

  logTwilio("info", "create-call:success", {
    runId,
    callSid: json?.sid,
    twilioStatus: json?.status,
    direction: json?.direction,
    accountSid: config.accountSid,
  });

  return {
    callSid: json.sid as string,
    twilioStatus: json.status as string,
    toNumber: config.toNumber,
  };
}

export async function endTwilioCall(callSid: string) {
  const config = getTwilioConfig();
  const params = new URLSearchParams();
  params.set("Status", "completed");

  logTwilio("info", "end-call:start", {
    callSid,
    accountSid: config.accountSid,
  });

  await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Calls/${callSid}.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${encodeBase64(`${config.accountSid}:${config.authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: params.toString(),
    },
  ).catch((error) => {
    logTwilio("warn", "end-call:failed", {
      callSid,
      accountSid: config.accountSid,
      error: error instanceof Error ? error.message : String(error),
    });
    // A failed hangup should not mask the original provider error.
  });
}

export function buildTwimlStreamResponse(data: { runId: string; callSid?: string | null }) {
  const { mediaStreamUrl } = getTwilioConfig();
  const streamToken = createTwilioStreamToken({
    runId: data.runId,
    callSid: data.callSid ?? null,
  });
  logTwilio("info", "twiml:build", {
    runId: data.runId,
    callSid: data.callSid ?? null,
    mediaStreamUrl: `${mediaStreamUrl}/twilio/media-stream`,
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    "  <Connect>",
    `    <Stream url="${escapeXml(`${mediaStreamUrl}/twilio/media-stream`)}">`,
    `      <Parameter name="runId" value="${escapeXml(data.runId)}" />`,
    `      <Parameter name="streamToken" value="${escapeXml(streamToken)}" />`,
    "    </Stream>",
    "  </Connect>",
    "</Response>",
  ].join("\n");
}

export function mapTwilioStatusToRunStatus(status: string | null | undefined) {
  switch (status) {
    case "queued":
    case "initiated":
    case "ringing":
      return "dialing";
    case "in-progress":
      return "in_progress";
    case "busy":
      return "busy";
    case "no-answer":
      return "no_answer";
    case "canceled":
      return "canceled";
    case "failed":
      return "failed";
    case "completed":
      return "completed";
    default:
      return "dialing";
  }
}

export function isTerminalTwilioStatus(status: string | null | undefined) {
  return !!status && TERMINAL_TWILIO_STATUSES.has(status);
}

export async function validateTwilioRequestSignature(
  request: Request,
  params?: Record<string, string>,
) {
  const authToken = getRequiredEnv("TWILIO_AUTH_TOKEN");
  const signature = request.headers.get("X-Twilio-Signature");
  if (!signature) {
    logTwilio("warn", "signature:missing", {
      url: request.url,
      method: request.method,
    });
    return false;
  }

  const valid = twilio.validateRequest(authToken, signature, request.url, params ?? {});
  if (!valid) {
    logTwilio("warn", "signature:invalid", {
      url: request.url,
      method: request.method,
      providedSignature: signature,
      paramKeys: params ? Object.keys(params) : [],
    });
  }
  return valid;
}

export function toTwilioParamRecord(formData: FormData) {
  const params: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      params[key] = value;
    }
  }
  return params;
}

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    logTwilio("error", "env:missing", { name });
    throw new Error(`${name} not configured`);
  }
  return value;
}

function encodeBase64(value: string) {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value).toString("base64");
  }
  return btoa(value);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function logTwilioNumberOwnership(config: ReturnType<typeof getTwilioConfig>) {
  const authHeader = {
    Authorization: `Basic ${encodeBase64(`${config.accountSid}:${config.authToken}`)}`,
  };

  try {
    const [incomingRes, callerIdRes] = await Promise.all([
      fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(config.fromNumber)}`,
        { headers: authHeader },
      ),
      fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/OutgoingCallerIds.json?PhoneNumber=${encodeURIComponent(config.fromNumber)}`,
        { headers: authHeader },
      ),
    ]);

    const incomingJson = await incomingRes.json().catch(() => null);
    const callerIdJson = await callerIdRes.json().catch(() => null);

    logTwilio("info", "create-call:preflight", {
      accountSid: config.accountSid,
      fromPhone: config.fromNumber,
      toPhone: config.toNumber,
      incomingNumberMatches: incomingJson?.incoming_phone_numbers?.length ?? 0,
      outgoingCallerIdMatches: callerIdJson?.outgoing_caller_ids?.length ?? 0,
      incomingNumberSid: incomingJson?.incoming_phone_numbers?.[0]?.sid ?? null,
      outgoingCallerIdSid: callerIdJson?.outgoing_caller_ids?.[0]?.sid ?? null,
      twilioApiRegionHint: "Calls API account must own or verify the From number",
    });
  } catch (error) {
    logTwilio("warn", "create-call:preflight-failed", {
      accountSid: config.accountSid,
      fromPhone: config.fromNumber,
      toPhone: config.toNumber,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
