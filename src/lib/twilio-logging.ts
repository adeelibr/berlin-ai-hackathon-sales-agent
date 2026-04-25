type LogLevel = "info" | "warn" | "error";

export function logTwilio(level: LogLevel, event: string, details?: Record<string, unknown>) {
  const logger = level === "error" ? console.error : level === "warn" ? console.warn : console.info;
  if (!details) {
    logger(`[twilio] ${event}`);
    return;
  }

  logger(`[twilio] ${event}`, sanitize(details));
}

export function maskAccountSid(value: string | null | undefined) {
  if (!value) return value ?? null;
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function maskPhoneNumber(value: string | null | undefined) {
  if (!value) return value ?? null;
  if (value.length <= 5) return value;
  return `${value.slice(0, 3)}...${value.slice(-2)}`;
}

function sanitize(input: unknown): unknown {
  if (Array.isArray(input)) {
    return input.map(sanitize);
  }

  if (!input || typeof input !== "object") {
    return input;
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (key.toLowerCase().includes("token") || key.toLowerCase().includes("authorization")) {
      sanitized[key] = "[redacted]";
    } else if (key.toLowerCase().includes("signature")) {
      sanitized[key] = typeof value === "string" ? maskTail(value) : "[redacted]";
    } else if (key.toLowerCase().includes("sid")) {
      sanitized[key] = typeof value === "string" ? maskAccountSid(value) : sanitize(value);
    } else if (key.toLowerCase().includes("phone") || key === "from" || key === "to") {
      sanitized[key] = typeof value === "string" ? maskPhoneNumber(value) : sanitize(value);
    } else {
      sanitized[key] = sanitize(value);
    }
  }
  return sanitized;
}

function maskTail(value: string) {
  if (value.length <= 8) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
