# Berlin AI Hackathon Sales Agent

This project supports two outbound call demo modes:

- `dummy`: a browser-based iPhone-style demo handset at `/phone-dummy/<number>`
- `twilio`: a real outbound Twilio phone call using the local Node media bridge

This guide explains how to run the project locally, configure `.env`, expose it with ngrok, and demo both transports.

The guide assumes:

- your machine is running macOS or Linux
- you run the app from the repository root
- you use ngrok to expose local services publicly
- you already have Supabase, OpenAI, and Gradium credentials

## 1. What Runs Locally

The demo uses two local services:

1. The main app on port `8080`
2. The Node media bridge on port `8788`

The media bridge handles:

- dummy phone websocket signaling and WebRTC audio
- Twilio media-stream websocket audio
- STT, TTS, and reply generation integration

## 2. Prerequisites

Before starting, make sure you have:

- Node.js 22+ recommended
- npm
- ngrok
- a Supabase project
- an OpenAI API key
- a Gradium API key
- a Twilio account and phone number if you want to demo `twilio` mode

If you want to use Supabase CLI for migrations:

```bash
brew install supabase/tap/supabase
```

## 3. Install Dependencies

From the repo root:

```bash
npm install
```

## 4. Configure `.env`

Create your real `.env` by copying the template:

```bash
cp .example.env .env
```

Then fill in the values.

### 4.1 Minimum `.env` for dummy-phone mode

Use this when you want the browser-based phone demo:

```env
# Supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# AI / speech
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-4o-mini
GRADIUM_API_KEY=YOUR_GRADIUM_API_KEY

# Transport selection
CALL_TRANSPORT_MODE=dummy
CALL_TARGET_NUMBER=49123456789

# Public URLs
PUBLIC_BASE_URL=https://YOUR-APP-TUNNEL.ngrok-free.app
DUMMY_PHONE_SERVICE_URL=https://YOUR-MEDIA-TUNNEL.ngrok-free.app

# Dummy phone UI / service
DUMMY_PHONE_CALLER_LABEL=Stillwater Demo
DUMMY_PHONE_MEDIA_PORT=8788

# Not used in dummy mode, but harmless if present
TWILIO_MEDIA_STREAM_BASE_URL=
TWILIO_MEDIA_STREAM_SECRET=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
```

Important notes:

- `CALL_TARGET_NUMBER` is the identifier the dummy phone page listens on.
- The phone page URL must match it exactly:
  `https://YOUR-APP-TUNNEL.ngrok-free.app/phone-dummy/49123456789`
- `PUBLIC_BASE_URL` must point to the app tunnel.
- `DUMMY_PHONE_SERVICE_URL` must point to the media-bridge tunnel.

### 4.2 Minimum `.env` for Twilio mode

Use this when you want a real Twilio call:

```env
# Supabase
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SECRET_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY

# AI / speech
OPENAI_API_KEY=YOUR_OPENAI_API_KEY
OPENAI_MODEL=gpt-4o-mini
GRADIUM_API_KEY=YOUR_GRADIUM_API_KEY

# Transport selection
CALL_TRANSPORT_MODE=twilio
CALL_TARGET_NUMBER=+491234567890

# Public URLs
PUBLIC_BASE_URL=https://YOUR-APP-TUNNEL.ngrok-free.app
DUMMY_PHONE_SERVICE_URL=https://YOUR-MEDIA-TUNNEL.ngrok-free.app
TWILIO_MEDIA_STREAM_BASE_URL=https://YOUR-MEDIA-TUNNEL.ngrok-free.app

# Shared secret for signed Twilio media-stream tokens
TWILIO_MEDIA_STREAM_SECRET=replace-this-with-a-long-random-secret

# Media service
DUMMY_PHONE_CALLER_LABEL=Stillwater Demo
DUMMY_PHONE_MEDIA_PORT=8788

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
```

Important notes:

- `CALL_TARGET_NUMBER` is the actual phone number Twilio calls.
- `PUBLIC_BASE_URL` is used for TwiML and status callbacks.
- `TWILIO_MEDIA_STREAM_BASE_URL` must point to the public media-bridge tunnel, not the app tunnel.
- `TWILIO_MEDIA_STREAM_SECRET` must be set or Twilio media authentication will fail.
- `DUMMY_PHONE_SERVICE_URL` is still used because the same Node service handles both transports.

## 5. Apply the Database Migrations

The app expects the Supabase schema in `supabase/migrations/`.

If you use Supabase CLI:

```bash
supabase db push
```

If you do not use the CLI, run the SQL migrations in your Supabase project manually. The key ones for calling are:

- [supabase/migrations/20260425170000_add_twilio_run_fields.sql](/Users/bseuss/.codex/worktrees/8712/berlin-ai-hackathon-sales-agent/supabase/migrations/20260425170000_add_twilio_run_fields.sql)
- [supabase/migrations/20260425183000_add_dummy_call_fields.sql](/Users/bseuss/.codex/worktrees/8712/berlin-ai-hackathon-sales-agent/supabase/migrations/20260425183000_add_dummy_call_fields.sql)

## 6. Update the Vite ngrok Host

This project currently has a hardcoded ngrok hostname in [vite.config.ts](/Users/bseuss/.codex/worktrees/8712/berlin-ai-hackathon-sales-agent/vite.config.ts).

You need to replace the `allowedHosts` entry with your current app tunnel hostname:

```ts
server: {
  host: "::",
  port: 8080,
  allowedHosts: ["your-current-app-tunnel.ngrok-free.app"],
},
```

If you do not do this, Vite may reject requests from your current tunnel.

## 7. Start the Local Services

Use four terminals.

### Terminal 1: app

```bash
npm run dev
```

This starts the main app on `http://localhost:8080`.

### Terminal 2: media bridge

```bash
npm run dummy-phone-media
```

This starts the Node media service on `http://localhost:8788`.

### Terminal 3: app tunnel

```bash
ngrok http 8080
```

Copy the generated HTTPS URL into:

- `PUBLIC_BASE_URL`

### Terminal 4: media bridge tunnel

```bash
ngrok http 8788
```

Copy the generated HTTPS URL into:

- `DUMMY_PHONE_SERVICE_URL`
- `TWILIO_MEDIA_STREAM_BASE_URL` for Twilio mode

After changing `.env`, restart:

```bash
npm run dev
```

and:

```bash
npm run dummy-phone-media
```

## 8. Optional Sanity Check

Before demoing, you can confirm the repo still builds:

```bash
npm run build
```

The current build may print a Wrangler log-file permission warning on macOS. That warning is known and does not block a successful build.

## 9. Dummy-Phone Demo Flow

This is the cheapest demo path because it avoids Twilio call costs.

### 9.1 Open the handset page on your phone

On your phone, open:

```text
https://YOUR-APP-TUNNEL.ngrok-free.app/phone-dummy/49123456789
```

Use the exact same number as `CALL_TARGET_NUMBER`.

Keep the page open in the foreground for the most reliable behavior.

### 9.2 Start the workflow

On your laptop:

1. Open the app in the browser using `PUBLIC_BASE_URL`
2. Log in if needed
3. Open a flow
4. Start the workflow

### 9.3 What should happen

The phone page should:

- register itself with the media bridge
- switch to an incoming-call screen
- ring and vibrate
- let you accept or decline

After tapping `Accept`:

- the browser asks for microphone permission
- WebRTC connects to the media bridge
- the agent greeting plays
- you can speak and hear responses

### 9.4 Dummy-phone troubleshooting

If the page does not ring:

- confirm `CALL_TRANSPORT_MODE=dummy`
- confirm `CALL_TARGET_NUMBER` exactly matches the URL segment
- confirm `DUMMY_PHONE_SERVICE_URL` matches the current ngrok media URL
- confirm the media service is running
- confirm the page is still open on the phone

If the page rings but audio fails:

- grant microphone access on the phone
- make sure the media service terminal has no STT/TTS/OpenAI errors
- verify `OPENAI_API_KEY` and `GRADIUM_API_KEY`

## 10. Twilio Demo Flow

This path places a real Twilio call and uses the same local Node bridge for live media.

### 10.1 Required Twilio configuration

Your `.env` must include:

- `CALL_TRANSPORT_MODE=twilio`
- `CALL_TARGET_NUMBER=<real phone number>`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `PUBLIC_BASE_URL=<app tunnel>`
- `TWILIO_MEDIA_STREAM_BASE_URL=<media tunnel>`
- `TWILIO_MEDIA_STREAM_SECRET=<shared secret>`

### 10.2 Start the services

Run the same four terminals as in the dummy flow:

```bash
npm run dev
```

```bash
npm run dummy-phone-media
```

```bash
ngrok http 8080
```

```bash
ngrok http 8788
```

### 10.3 Start the workflow

On your laptop:

1. Open the app using `PUBLIC_BASE_URL`
2. Open a flow
3. Start the workflow

### 10.4 What should happen

The app should:

- create the run in Supabase
- place an outbound call via Twilio
- serve TwiML from the app tunnel
- instruct Twilio to open its media stream against the media-bridge tunnel
- authenticate that stream with a signed token

Then:

- your real phone rings
- answering the call starts the agent greeting
- your speech is transcribed by Gradium
- the reply is generated by OpenAI
- the reply audio is synthesized and played back over the Twilio call

### 10.5 Twilio troubleshooting

If the phone never rings:

- confirm `CALL_TRANSPORT_MODE=twilio`
- confirm `CALL_TARGET_NUMBER` is a valid real number in E.164 format
- confirm `TWILIO_FROM_NUMBER` is owned by your Twilio account
- inspect the app terminal for Twilio call-creation errors

If the phone rings but no conversation starts:

- confirm `TWILIO_MEDIA_STREAM_BASE_URL` points to the media tunnel, not the app tunnel
- confirm `TWILIO_MEDIA_STREAM_SECRET` is set
- inspect the media service logs for token verification or websocket errors

If greeting works but speaking fails:

- inspect the media service logs for STT errors
- confirm `GRADIUM_API_KEY`
- confirm `OPENAI_API_KEY`

## 11. Useful URLs During the Demo

App:

```text
https://YOUR-APP-TUNNEL.ngrok-free.app
```

Dummy handset:

```text
https://YOUR-APP-TUNNEL.ngrok-free.app/phone-dummy/<CALL_TARGET_NUMBER>
```

Media bridge health:

```text
https://YOUR-MEDIA-TUNNEL.ngrok-free.app/health
```

## 12. Recommended Demo Sequence

If you want the safest live demo sequence:

1. Start with `dummy` mode
2. Verify the browser handset rings and connects
3. Show one successful conversation turn
4. Switch to `twilio` mode only if you specifically want to show a real phone call

This avoids spending time debugging carrier or Twilio account issues during the first demo.

## 13. Quick Start Checklist

Before demoing, confirm all of this:

- `npm install` completed
- Supabase migrations are applied
- `.env` exists and is filled in
- `vite.config.ts` contains the current app ngrok hostname in `allowedHosts`
- `npm run dev` is running
- `npm run dummy-phone-media` is running
- `ngrok http 8080` is running
- `ngrok http 8788` is running
- `.env` uses the current ngrok URLs
- you restarted the app and media service after editing `.env`
- for dummy mode, the phone is already open on `/phone-dummy/<CALL_TARGET_NUMBER>`

## 14. Common Failure Points

- stale ngrok URLs in `.env`
- stale ngrok hostname in `vite.config.ts`
- missing `SUPABASE_SECRET_KEY`
- missing `OPENAI_API_KEY`
- missing `GRADIUM_API_KEY`
- missing `TWILIO_MEDIA_STREAM_SECRET` in Twilio mode
- using the app tunnel instead of the media tunnel for `TWILIO_MEDIA_STREAM_BASE_URL`
- forgetting to restart the processes after editing `.env`
- using a dummy identifier instead of a real phone number in Twilio mode
