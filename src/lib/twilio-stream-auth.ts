import { createHmac, timingSafeEqual } from "node:crypto";

type TwilioStreamTokenPayload = {
  runId: string;
  exp: number;
  iat: number;
  callSid?: string;
};

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export function createTwilioStreamToken(data: { runId: string; callSid?: string | null }) {
  const now = Date.now();
  const payload: TwilioStreamTokenPayload = {
    runId: data.runId,
    iat: now,
    exp: now + DEFAULT_TTL_MS,
    ...(data.callSid ? { callSid: data.callSid } : {}),
  };

  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyTwilioStreamToken(token: string) {
  const [encodedPayload, encodedSignature] = token.split(".");
  if (!encodedPayload || !encodedSignature) {
    throw new Error("Malformed Twilio stream token");
  }

  const expectedSignature = sign(encodedPayload);
  const providedSignature = decodeBase64UrlToBuffer(encodedSignature);
  const expectedSignatureBuffer = decodeBase64UrlToBuffer(expectedSignature);

  if (
    providedSignature.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(providedSignature, expectedSignatureBuffer)
  ) {
    throw new Error("Invalid Twilio stream token signature");
  }

  const payload = JSON.parse(decodeBase64Url(encodedPayload)) as TwilioStreamTokenPayload;
  if (!payload.runId || !payload.exp || !payload.iat) {
    throw new Error("Twilio stream token payload incomplete");
  }
  if (payload.exp < Date.now()) {
    throw new Error("Twilio stream token expired");
  }

  return payload;
}

function sign(encodedPayload: string) {
  return encodeBase64Url(
    createHmac("sha256", getTwilioStreamSecret()).update(encodedPayload).digest(),
  );
}

function getTwilioStreamSecret() {
  const secret = process.env.TWILIO_MEDIA_STREAM_SECRET;
  if (!secret) {
    throw new Error("TWILIO_MEDIA_STREAM_SECRET not configured");
  }
  return secret;
}

function encodeBase64Url(value: string | Uint8Array) {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : Buffer.from(value);
  return buffer.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  return Buffer.from(normalizeBase64Url(value), "base64").toString("utf8");
}

function decodeBase64UrlToBuffer(value: string) {
  return Buffer.from(normalizeBase64Url(value), "base64");
}

function normalizeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padding = normalized.length % 4 === 0 ? 0 : 4 - (normalized.length % 4);
  return normalized + "=".repeat(padding);
}
