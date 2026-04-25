import { createFileRoute } from "@tanstack/react-router";
import { handleTwilioMediaStream } from "@/lib/twilio-media";

export const Route = createFileRoute("/api/twilio/media-stream")({
  server: {
    handlers: {
      GET: async ({ request }) => handleTwilioMediaStream(request),
    },
  },
});
