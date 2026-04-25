# Hermozi Cold Call Flow — Hackathon Plan

A calm, zen marketing landing page that funnels into an authenticated dashboard where users build and run a fixed 5-node cold-call workflow. Each run uses a Hermozi-skilled AI agent to generate the script, makes the call via Telli, enhances audio in both directions with ai-coustics, and logs the result to the dashboard.

## 1. Public landing page (`/`)

A minimal, zen aesthetic — generous whitespace, soft neutral palette, one calm serif/sans pairing.

- **Hero**: short tagline ("Cold calls that close themselves."), one-line subtext, primary CTA → **Sign in / Get started**.
- Subtle background motion (gentle gradient or particle drift), nothing busy.
- Footer: built for Berlin AI Hackathon, links to login.

## 2. Auth (`/login`)

- Lovable Cloud email/password auth (no Google).
- Sign up → auto-redirect to `/dashboard`.
- Logged-in users hitting `/` get redirected to `/dashboard`.

## 3. Dashboard (`/dashboard`)

The user's home after login.

- **My Flows** list — cards showing each saved flow (name, last run, status).
- "New Flow" button → creates a flow and opens the builder.
- Recent runs feed at the bottom (last 10 calls across all flows with outcome chips).

## 4. Flow builder (`/flows/$flowId`)

A clean canvas with the **5 fixed nodes** laid out left-to-right, connected by lines (visual only — no drag-and-drop, no add/remove). Click any node to open its config panel on the right.

| # | Node | Purpose | Config |
|---|------|---------|--------|
| 1 | **Who we are** | Your company context, saved per flow | Two free-text fields: "Who we are", "What we do" |
| 2 | **Phone numbers** | Call targets | Single textarea, comma-separated E.164 numbers (e.g. `+4915112345678, +4915198765432`) |
| 3 | **Hermozi knowledge** | Editable knowledge base injected into the agent | Large textarea pre-filled with curated Hermozi notes (Grand Slam Offer, value equation, hooks, CTA frameworks). User can edit/append. |
| 4 | **Make the call** | Executes outbound call per number | Toggle for ai-coustics pre-call TTS enhancement, voice/language picker, hard 2-min cap (read-only) |
| 5 | **Log result** | Stores transcript + outcome on dashboard | Auto-runs; no config |

Top of the canvas: flow name (inline-editable), **Save**, and **Run flow** buttons.

## 5. Run execution

Clicking **Run flow** kicks off this server-side pipeline for each phone number, with live per-node status (idle → running → done/error) on the canvas:

1. **Node 1+3 → Hermozi agent**: A server function calls Lovable AI (`google/gemini-3-flash-preview`) with a system prompt built from "Who we are / What we do" + the Hermozi knowledge text. Output: a tight cold-call script + opening hook, capped to fit a 2-min call.
2. **Node 4 pre-call**: Script is converted to TTS audio. If the ai-coustics toggle is on, the audio is sent to **ai-coustics REST API** (Finch model) to clean/normalize before the call.
3. **Node 4 call**: Server function POSTs to **Telli (teli.ai)** to initiate the outbound call with the prepared script/audio, the target number, and `max_duration_seconds: 120`.
4. **Webhook callback**: A public route at `/api/public/telli/webhook` receives Telli's call-completed callback (signature-verified) with recording URL + transcript.
5. **Node 4 post-call**: Recording URL is fetched and sent to **ai-coustics REST API** (Lark model) for cleanup. Cleaned audio + transcript stored.
6. **Node 5 logging**: Outcome (`completed`, `no-answer`, `failed`, duration, transcript, cleaned audio link) is written to the runs table and pushed live to the dashboard.

## 6. Run detail (`/runs/$runId`)

Per-call detail page showing: target number, duration, outcome, full transcript, audio player for the cleaned recording, the exact script the agent generated, timing of each node.

## 7. Backend / data

Lovable Cloud tables:
- `profiles` — minimal user profile
- `flows` — id, user_id, name, who_we_are, what_we_do, hermozi_knowledge, phone_numbers, voice_settings
- `runs` — id, flow_id, user_id, phone_number, status, generated_script, transcript, recording_url, cleaned_recording_url, duration_seconds, telli_call_id, started_at, completed_at, error
- RLS: each user only sees their own flows/runs.

Server-side (TanStack Start server functions + public route for webhook):
- `runFlow(flowId)` — orchestrator
- `generateScript` — Lovable AI Gateway call
- `enhanceAudio` — ai-coustics REST proxy
- `placeCall` — Telli REST proxy
- `/api/public/telli/webhook` — signature-verified callback receiver

## 8. Secrets you'll add when ready

I'll prompt for these at the right moment (no need to share now):
- `TELLI_API_KEY` — from teli.ai dashboard, sent as `X-API-Key`
- `TELLI_WEBHOOK_SECRET` — for HMAC verification of callbacks
- `AICOUSTICS_API_KEY` — from ai-coustics developer portal
- `LOVABLE_API_KEY` — auto-provided by Lovable Cloud, no action needed

## 9. Design system

- **Palette**: warm off-white background, deep ink text, single muted accent (sage or soft indigo)
- **Type**: one elegant serif for headings (e.g. Fraunces), clean sans for body (Inter)
- **Motion**: slow fades, no bounces; the canvas nodes pulse gently when running

## 10. What's out of scope for the hackathon

- No drag-and-drop node editing (5 nodes are fixed)
- No team/workspace sharing
- No billing UI
- No SMS, only voice calls
- English-only Hermozi prompt (other languages can be added by editing Node 3 text)

## 11. Build order

1. Set up Lovable Cloud + auth + DB schema
2. Landing page + login + empty dashboard shell
3. Flow builder UI with 5-node canvas + per-node config
4. Hermozi script generation via Lovable AI
5. Telli call placement + webhook receiver
6. ai-coustics pre + post processing
7. Run detail page + live status updates
8. Polish: zen visual pass, motion, edge-case states