# Demo Guide

This guide is optimized for the required 2-minute hackathon video.

## Recommended Demo Mode

Use `dummy` mode for the recorded demo unless the goal is specifically to prove a real phone call through Twilio.

Dummy mode is faster and safer because it avoids:

- Carrier delays.
- Twilio account or phone-number configuration issues.
- Public webhook signature/debugging problems during recording.

## Pre-Recording Checklist

- Dependencies installed with `npm install`.
- Supabase migrations applied.
- `.env` filled with Supabase, OpenAI, and Gradium credentials.
- `CALL_TRANSPORT_MODE=dummy`.
- `CALL_TARGET_NUMBER` matches the dummy phone route number.
- Main app running with `npm run dev`.
- Media bridge running with `npm run dummy-phone-media`.
- Dummy handset open at `/phone-dummy/<CALL_TARGET_NUMBER>`.
- A test flow already exists with company context and offer details.
- Browser microphone permission has already been granted.

## Suggested 2-Minute Storyboard

### 0:00-0:15 - Problem

Show the app and briefly state the problem:

> Sales teams spend too much time manually qualifying leads. This prototype lets a team configure an AI sales agent, place an outbound call, and generate a structured sales report from the conversation.

### 0:15-0:45 - Configure the Agent

Open a flow and show:

- Company context.
- What the company sells.
- Agent persona and behavior instructions.
- The active call transport and target number.

Keep the narration short. The UI should do most of the explanation.

### 0:45-1:25 - Live Call

Open the dummy phone page, then start the call from the flow.

Show:

- Incoming call screen.
- Accepting the call.
- Agent greeting.
- One user response.
- One agent reply.

Do not aim for a long conversation. One clean turn is enough.

### 1:25-1:50 - Transcript and Report

Open the run detail page and show:

- Call status.
- Transcript.
- Generate report button.
- Structured report with summary, sentiment, intent score, pain points, objections, opportunities, and next steps.

### 1:50-2:00 - Close

End with the value proposition:

> The result is an end-to-end outbound sales-agent workflow: configure the agent, place a live call, capture the transcript, and produce a sales-ready report.

## Demo Script

Use this as a loose script, not something to read word-for-word:

> This is our AI sales-agent workflow. I start by defining who we are, what we sell, and how the agent should behave on the call.
>
> For the hackathon demo we use the dummy phone mode, which gives us a browser-based handset and avoids phone-carrier delays while keeping the same voice pipeline.
>
> When I start the workflow, the phone rings. I accept the call, the agent greets me, listens to my response, transcribes it, generates a short sales reply, and speaks it back.
>
> After the call, the run page shows the transcript and can generate a structured sales report with sentiment, intent, objections, opportunities, and next steps for a sales team.

## Common Demo Failure Points

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| App fails on startup | Missing `.env` values | Fill Supabase keys and restart. |
| Dummy phone does not ring | Number mismatch | Make `CALL_TARGET_NUMBER` match `/phone-dummy/<number>`. |
| Dummy phone cannot connect | Media bridge not running | Start `npm run dummy-phone-media`. |
| No audio | Browser microphone permission | Grant permission and reload the handset. |
| Agent cannot reply | Missing `OPENAI_API_KEY` | Add key and restart both services. |
| No speech output/transcription | Missing `GRADIUM_API_KEY` | Add key and restart both services. |
| Public phone URL fails | Stale ngrok URL | Update `.env` and `vite.config.ts`, then restart. |
