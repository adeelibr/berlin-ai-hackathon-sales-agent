import { getDummyPhoneServiceUrl } from "./call-config";

export type DummyCallStatus =
  | "ringing"
  | "connecting"
  | "in-progress"
  | "completed"
  | "failed"
  | "canceled"
  | "no-answer";

export function mapDummyStatusToRunStatus(status: DummyCallStatus) {
  switch (status) {
    case "ringing":
      return "ringing";
    case "connecting":
      return "dialing";
    case "in-progress":
      return "in_progress";
    case "completed":
      return "completed";
    case "canceled":
      return "canceled";
    case "no-answer":
      return "no_answer";
    case "failed":
    default:
      return "failed";
  }
}

export async function startDummyCall(data: {
  runId: string;
  number: string;
  whoWeAre: string;
  whatWeDo: string;
  persona: string;
}) {
  const response = await fetch(`${getDummyPhoneServiceUrl()}/calls`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof json?.error === "string"
        ? json.error
        : `Dummy phone call creation failed (${response.status})`;
    throw new Error(message);
  }

  return {
    callId: String(json.callId),
    sessionId: String(json.sessionId),
    status: json.status as DummyCallStatus,
  };
}

export async function endDummyCall(callId: string) {
  await fetch(`${getDummyPhoneServiceUrl()}/calls/${encodeURIComponent(callId)}/hangup`, {
    method: "POST",
  }).catch(() => {
    // Ignore hangup failures; they should not mask the original error path.
  });
}
