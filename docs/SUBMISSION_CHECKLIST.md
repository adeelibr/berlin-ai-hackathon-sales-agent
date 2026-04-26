# Hackathon Submission Checklist

## Required Submission Items

- 2-minute video demo, for example Loom.
- Public GitHub repository.
- Source code.
- README.
- Documentation.
- Setup instructions.

## Repository Readiness

| Item | Status | Notes |
| --- | --- | --- |
| Source code | Present | Main app, media bridge, Supabase migrations, and integrations are in the repo. |
| README | Present | `README.md` includes local setup, environment variables, and demo flows. |
| Architecture docs | Present | See `docs/ARCHITECTURE.md`. |
| Demo docs | Present | See `docs/DEMO.md`. |
| Setup instructions | Present | Main setup is in `README.md`; quick demo setup is in `docs/DEMO.md`. |
| Public repository | Pending | The repo currently points to `adeelibr/berlin-ai-hackathon-sales-agent`. Confirm it is public before submission. |
| Video demo | Pending | Record after environment variables and dummy phone mode are working. |

## Before Making the Repo Public

- Confirm `.env` is not committed.
- Confirm no API keys are present in source files, README, screenshots, or video.
- Confirm Supabase service-role keys are not exposed in client code.
- Confirm the GitHub repository visibility is public.
- Confirm the default branch is `main`.
- Run `npm run build`.

## Recommended Video Submission Path

Use dummy-phone mode for the official demo:

1. Start the app with `npm run dev`.
2. Start the media bridge with `npm run dummy-phone-media`.
3. Open the dummy phone page.
4. Create or open a flow.
5. Start a call.
6. Show one clean conversation turn.
7. Open the run detail page.
8. Generate and show the sales report.

## Commands

```bash
npm install
npm run build
npm run dev
npm run dummy-phone-media
```

## Environment Needed for Demo

Minimum for dummy mode:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
OPENAI_API_KEY=
GRADIUM_API_KEY=
CALL_TRANSPORT_MODE=dummy
CALL_TARGET_NUMBER=49123456789
DUMMY_PHONE_SERVICE_URL=http://localhost:8788
PUBLIC_BASE_URL=http://localhost:8080
```

## Final Submission Notes

The repository should emphasize that this is an end-to-end prototype:

- Configure an AI sales-agent workflow.
- Launch an outbound voice interaction.
- Use live speech-to-text and text-to-speech.
- Store transcript and run status.
- Generate a structured post-call sales report.

For the video, prioritize reliability and clarity over showing every feature.
