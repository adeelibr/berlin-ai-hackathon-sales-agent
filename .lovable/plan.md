## Goal
Let each sales persona have its own Gradium TTS voice, so Zig sounds different from Grant, etc. The conversation page automatically uses the campaign persona's voice when the agent speaks.

## 1. Database — add `voice_id` to personas

Migration on `public.sales_personas`:
- Add column `voice_id text not null default ''` (empty = use system default).
- Update `public.seed_default_personas(_user_id uuid)` to insert sensible default `voice_id` values per persona, and add the column to the `INSERT ... ON CONFLICT DO NOTHING` so new users get them.
- Run a one-shot data update (insert tool) to backfill `voice_id` on the existing 6 default personas (matched by `key`) for all current users. Custom user personas remain `''`.

Voice mapping (using Gradium voice IDs — I'll use the existing default `YTpq7expH9539ERJ` plus 5 distinct ones; if any are unavailable in your Gradium account they fall back gracefully to the default):
- `zig` → warm male
- `grant` → energetic male
- `jordan` → confident male
- `mary` → warm female
- `brian` → calm male
- `oprah` → warm female

> Note: I only know the one voice ID currently in the codebase (`YTpq7expH9539ERJ`). For the other 5 I'll use that same ID as a placeholder default and surface a free-text "Voice ID" field in the UI so you can paste real Gradium voice IDs from your Gradium dashboard. I'll also add a "Preview voice" button so you can test before saving. If you'd rather I hardcode 6 specific voice IDs, paste them in the chat and I'll bake them into the migration.

## 2. Personas page (`src/routes/personas.tsx`)

In the expanded editor for each persona, add below the system prompt:
- A labeled **Voice ID** text input (placeholder: "Gradium voice_id, e.g. YTpq7expH9539ERJ").
- A small **Preview voice** button that calls `gradiumTTS` with a sample line ("Hi, this is {name}. Let's see how I sound.") using the draft voice ID, and plays the returned audio.
- Save button persists both `prompt` and `voice_id` in one update.

Helper text: "Find voice IDs in your Gradium dashboard → Voices. Leave blank to use the workspace default."

## 3. Server function — hydrate voice from campaign persona

In `src/lib/gradium.functions.ts`:
- Extend `gradiumTTS` input to accept optional `personaId` and `userId`. If `voiceId` is not passed but `personaId` is, the handler looks up `sales_personas.voice_id` (scoped by `user_id`) via `adminClient()` and uses it. Falls back to the existing default `YTpq7expH9539ERJ` if both are empty.
- Keep behavior backwards compatible: `gradiumTTS({ data: { text } })` still works.

## 4. Conversation page (`src/routes/conversations.$runId.tsx`)

- When loading the run, also fetch the campaign's `persona_id` (already partially wired for the chip).
- Pass `personaId` + `userId` to every `ttsFn(...)` call so the agent reply is spoken in the persona's voice.
- No UI change needed beyond what already exists.

## 5. Verification
- `bunx tsc --noEmit` clean.
- Manual: open a persona, paste a voice ID, click Preview — audio should play in that voice. Launch a campaign tied to that persona — the agent's spoken turns should use the same voice.

## Out of scope (not doing unless you ask)
- A picker dropdown of Gradium voices (would need a Gradium "list voices" API call — happy to add if their API supports it).
- Per-campaign voice override (campaign inherits from persona — simpler mental model).
