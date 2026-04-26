# Technical Reference

This document explains the main APIs, frameworks, and tools used in the project in simple terms.

## What This Project Uses

| Category | Tool | Why It Is Used |
| --- | --- | --- |
| Web app framework | TanStack Start | Runs the React app, file-based routes, server functions, and API routes. |
| UI | React | Builds the dashboard, flow editor, run detail page, and dummy phone page. |
| Build tool | Vite | Starts the local dev server and creates production builds. |
| Styling | Tailwind CSS | Provides utility classes for the app UI. |
| UI primitives | Radix UI, shadcn-style components | Provides accessible dialogs, buttons, inputs, tabs, tooltips, and layout components. |
| Database and auth | Supabase | Stores users, flows, runs, transcripts, reports, and call state. |
| AI text generation | OpenAI Responses API | Generates live agent replies and structured sales reports. |
| Speech-to-text and text-to-speech | Gradium | Transcribes caller audio and turns agent replies into speech. |
| Real phone calls | Twilio | Places outbound calls and streams live audio in Twilio mode. |
| Local media bridge | Node.js, WebSocket, WebRTC | Connects browser/Twilio audio to the AI speech pipeline. |
| Public local tunnels | ngrok | Exposes local services when testing on a phone or using Twilio callbacks. |

## Main App Routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page. Redirects signed-in users to the dashboard. |
| `/login` | Sign in and sign up flow using Supabase auth. |
| `/dashboard` | Shows saved flows and recent call runs. |
| `/flows/$flowId` | Flow builder. Users define company context, agent instructions, and start calls. |
| `/runs/$runId` | Run detail page. Shows call status, transcript, errors, and generated sales report. |
| `/phone-dummy/$number` | Browser-based dummy phone used for low-cost local demos. |

## App API Routes

These routes are handled by the TanStack Start app.

| API Route | Method | Used By | Purpose |
| --- | --- | --- | --- |
| `/api/twilio/twiml/$runId` | `GET`, `POST` | Twilio | Returns TwiML telling Twilio where to open the media stream. |
| `/api/twilio/status/$runId` | `POST` | Twilio | Receives call status updates such as ringing, in-progress, completed, failed, or no-answer. |

The Twilio API routes validate Twilio request signatures before accepting webhook data.

## Media Bridge API

The media bridge is the separate Node service started with:

```bash
npm run dummy-phone-media
```

By default it runs on:

```text
http://localhost:8788
```

| Endpoint | Type | Purpose |
| --- | --- | --- |
| `/health` | HTTP `GET` | Simple health check for the media bridge. |
| `/calls` | HTTP `POST` | Starts a dummy-phone call for an existing run. |
| `/calls/:callId/hangup` | HTTP `POST` | Ends a dummy-phone call. |
| `/ws/phone-dummy` | WebSocket | Connects the browser dummy phone to the media bridge. |
| `/twilio/media-stream` | WebSocket | Receives live Twilio Media Stream audio. |

## Data Stored in Supabase

| Table | What It Stores |
| --- | --- |
| `flows` | The user-created sales workflow: name, company context, offer description, and agent persona. |
| `runs` | A single call attempt: status, transcript, report, transport mode, target number, provider IDs, errors, and timestamps. |

Database schema changes are stored in:

```text
supabase/migrations/
```

## How a Dummy Call Works

1. The user opens `/phone-dummy/<number>`.
2. The dummy phone registers with the media bridge over WebSocket.
3. The user starts a call from `/flows/$flowId`.
4. The app creates a `runs` row in Supabase.
5. The app asks the media bridge to call the registered dummy phone.
6. The dummy phone rings in the browser.
7. After the user accepts, WebRTC carries microphone and speaker audio.
8. Gradium transcribes the user's speech.
9. OpenAI generates the agent's reply.
10. Gradium turns the reply into speech.
11. The transcript is saved back to Supabase.

## How a Twilio Call Works

1. The user starts a call from `/flows/$flowId`.
2. The app creates a `runs` row in Supabase.
3. The app creates an outbound Twilio call.
4. Twilio requests `/api/twilio/twiml/$runId`.
5. The app returns TwiML with the media bridge WebSocket URL.
6. Twilio streams call audio to `/twilio/media-stream`.
7. The media bridge uses Gradium and OpenAI to run the conversation.
8. Twilio status callbacks update the run status in Supabase.

## Important Environment Variables

| Variable | Required For | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | App startup | Public Supabase project URL for the browser. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | App startup | Public Supabase anon key for the browser. |
| `SUPABASE_URL` | Server-side code | Supabase project URL for server functions and the media bridge. |
| `SUPABASE_PUBLISHABLE_KEY` | Server-side code | Supabase anon key for server-side usage. |
| `SUPABASE_SECRET_KEY` | Server-side code | Service-role key for trusted backend operations. |
| `OPENAI_API_KEY` | AI replies and reports | Lets the app call the OpenAI Responses API. |
| `OPENAI_MODEL` | AI replies and reports | Optional model override. Defaults to `gpt-4o-mini`. |
| `GRADIUM_API_KEY` | Voice features | Enables speech-to-text and text-to-speech. |
| `CALL_TRANSPORT_MODE` | Calling | Selects `dummy` or `twilio`. |
| `CALL_TARGET_NUMBER` | Calling | Target dummy identifier or real phone number. |
| `DUMMY_PHONE_SERVICE_URL` | Dummy mode | Public or local URL for the media bridge. |
| `TWILIO_MEDIA_STREAM_BASE_URL` | Twilio mode | Public media bridge URL for Twilio streams. |
| `TWILIO_MEDIA_STREAM_SECRET` | Twilio mode | Signs and verifies Twilio media-stream tokens. |
| `TWILIO_ACCOUNT_SID` | Twilio mode | Twilio account ID. |
| `TWILIO_AUTH_TOKEN` | Twilio mode | Twilio API token and webhook validation secret. |
| `TWILIO_FROM_NUMBER` | Twilio mode | Twilio-owned or verified caller number. |
| `PUBLIC_BASE_URL` | Twilio and public demos | Public app URL used for callbacks and shared phone links. |

## Useful Commands

| Command | What It Does |
| --- | --- |
| `npm install` | Installs project dependencies. |
| `npm run dev` | Starts the main app on port `8080`. |
| `npm run dummy-phone-media` | Starts the media bridge on port `8788`. |
| `npm run build` | Builds the app for production. |
| `npm run lint` | Runs ESLint and Prettier checks. |

## Files Worth Reading First

| File | Why It Matters |
| --- | --- |
| `README.md` | Full local setup and demo instructions. |
| `docs/ARCHITECTURE.md` | High-level system overview. |
| `src/routes/flows.$flowId.tsx` | Flow builder and call start UI. |
| `src/routes/runs.$runId.tsx` | Transcript and report UI. |
| `src/routes/phone-dummy.$number.tsx` | Browser dummy phone. |
| `services/dummy-phone-media/server.ts` | Live audio and call orchestration. |
| `src/lib/conversation-core.ts` | OpenAI, Gradium, transcript, and audio helpers. |
| `src/lib/twilio.ts` | Twilio call creation, TwiML, and webhook helpers. |
