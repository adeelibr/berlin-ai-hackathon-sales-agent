export type CallTransportMode = "twilio" | "dummy";

export function getCallTransportMode(): CallTransportMode {
  return process.env.CALL_TRANSPORT_MODE?.toLowerCase() === "dummy" ? "dummy" : "twilio";
}

export function getCallTargetNumber() {
  const value = process.env.CALL_TARGET_NUMBER || process.env.TWILIO_TO_NUMBER;
  if (!value) {
    throw new Error("CALL_TARGET_NUMBER not configured");
  }
  return value;
}

export function getDummyPhoneServiceUrl() {
  const value = process.env.DUMMY_PHONE_SERVICE_URL;
  if (!value) {
    throw new Error("DUMMY_PHONE_SERVICE_URL not configured");
  }
  return value.replace(/\/$/, "");
}

export function getDummyPhoneWebSocketBaseUrl() {
  return toWebSocketUrl(getDummyPhoneServiceUrl());
}

export function getPublicBaseUrl() {
  return process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") ?? null;
}

export function toWebSocketUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString().replace(/\/$/, "");
}
