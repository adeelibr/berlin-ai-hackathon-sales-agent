## Effort estimate

**Roughly one focused build session — ~1.5 to 2 days of work, in 4 phases.** None of it is risky; it's mostly structural (new tables, new pages, a sidebar shell) on top of design tokens that already match the mockups (Fraunces serif, warm paper background, sage `--accent`, soft shadows). All three AI integrations (Gradium, Lovable, Gemini) keep working unchanged — they just get re-pointed at the new "Campaign" object instead of "Flow."

The good news: zero of the actual voice/AI plumbing changes. `gradiumTTS`, `gradiumSTT`, `agentReply`, and `generateReport` server functions stay exactly as they are.

---

## Phase 1 — App shell with sidebar (~2–3 hrs)

Replace the current top-bar `AppShell` with the left sidebar from the mockups.

- New `src/components/AppSidebar.tsx` using shadcn's `Sidebar` primitive with three groups exactly as in the mockups:
  - **Workspace** — Dashboard, Leads, Company, Sales personas, Campaigns
  - **Operate** — Flows, Conversations
  - **System** — Settings
- Each item shows a small left "•" indicator dot; the active item gets the soft cream background pill (`bg-muted/60`) seen in the screenshots.
- Top of sidebar: "● Stillwater" wordmark. Bottom: avatar + `mara@stillwater.so` + sign-out menu (replaces the current header sign-out).
- Section labels use the existing `text-[10px] uppercase tracking-[0.2em] text-muted-foreground` pattern already in the codebase.
- Update `src/components/AppShell.tsx` to wrap children in `SidebarProvider` + `<AppSidebar />` + main content area. Keep `AuthGuard` unchanged.
- Counts next to "Leads (16)", "Sales personas (8)", "Campaigns (3)" come from a single `useSidebarCounts()` hook that does three lightweight `count` queries.

## Phase 2 — Database changes (~30 min)

One migration adding the new entities. Existing `flows` and `runs` tables stay; `flows` becomes the "Operate → Flows" advanced view (unchanged), and `campaigns` becomes the new primary object.

New tables (all with RLS `auth.uid() = user_id`, mirroring the existing pattern):

- **`company_profile`** — one row per user. Fields: `name`, `tagline`, `industry`, `website`, `linkedin`, `twitter`, `logo_url`, `what_we_do`, `value_prop`, `target_customer`. Powers the Company page; also feeds the agent's `whoWeAre` / `whatWeDo` automatically.
- **`sales_personas`** — `id`, `user_id`, `key` (slug), `name`, `tagline` (e.g. "The patient questioner"), `description`, `best_for` (text[]), `prompt` (full system-prompt body), `avatar_color`, `is_default`. Seeded with the 8 personas from the mockup (Margot, Hideo, Soraya, Bram, Iris, Cyrus, Lena, Otto) on first sign-in via the existing `handle_new_user()` trigger.
- **`leads`** — `id`, `user_id`, `name`, `company`, `phone`, `status` (`new` | `called` | `scheduled`), `notes`, `created_at`.
- **`campaigns`** — `id`, `user_id`, `name`, `persona_id` (FK → sales_personas), `brief` (text), `talking_points` (text[]), `status` (`draft` | `running` | `paused`), `created_at`, `updated_at`.
- **`campaign_leads`** — join table `campaign_id` ↔ `lead_id`.
- Add `campaign_id` (nullable) and `lead_id` (nullable) to `runs` so a conversation can be attributed back to its campaign + lead.

## Phase 3 — The five pages (~6–8 hrs total)

All pages reuse the existing typography/color system; they're mostly layout work.

### 3a. `src/routes/dashboard.tsx` — replace current dashboard
- "Good morning, Mara." (uses display_name from profile, time-of-day aware) + sub-line.
- Four stat cards: **Total leads / New / Called / Scheduled** — all from `leads` count queries.
- Two side-by-side cards: **"Three quiet things to do"** (derived: pending campaign drafts, unreviewed transcripts, campaigns missing a persona) and **"Now dialing"** (most recent active run with persona name + progress).

### 3b. `src/routes/leads.tsx` — new
- Header + "Add lead" button (opens dialog).
- Search input + filter chips: **All / New / Called / Scheduled** with counts.
- Numbered table rows (01, 02, …) with name, company, phone, status pill. Click a row to open a side panel with notes + "Assign to campaign" dropdown.
- Status pills use existing tokens: `--node-running` (called/sage), `--node-idle` (new), warm beige for scheduled.

### 3c. `src/routes/company.tsx` — new
- Single long form, autosaves on blur with a "Saved · just now" indicator (top-right, exactly like the mockup).
- Sections: **Identity** (name/tagline/industry/website/linkedin/twitter), **What we do**, **Value & customer** (value prop + target customer textareas).
- Right rail: logo upload (uses the existing `cleaned-recordings` bucket pattern — add a new public `company-logos` bucket) + Quick links preview.

### 3d. `src/routes/sales-personas.tsx` — new
- Header + "Issue 04 · Spring '26" subtle right-aligned label (pure decoration, hardcoded).
- Vertical stack of persona cards. Each card: circular monogram avatar (colored by `avatar_color`), name + italic tagline, description, "BEST FOR" tags.
- Selected persona gets the sage-tinted background ring (`bg-accent/10 ring-1 ring-accent/40`) seen in the mockup.
- Click to expand inline editor for the prompt text (only for user-edited copies; defaults stay read-only).

### 3e. `src/routes/campaigns.tsx` — new (replaces "Flows" as the primary CTA)
Two-column layout exactly like the mockup:
- **Left rail (`ALL CAMPAIGNS`)**: list of campaigns, each row showing name, lead count, voice (persona name), and a status dot (Running/Draft).
- **Right panel (selected campaign)**: name, status, persona card (with monogram), leads list with phone numbers and per-lead status, "Additional information & brief" textarea, "What to talk about" numbered talking-points editor (add/remove rows), and footer actions: **Launch campaign** / **Test with one number** / **Save as draft**.
- "Launch campaign" creates a `run` row pre-wired with `campaign_id` + `lead_id` and navigates to the existing `/conversations/$runId` page — so the actual voice loop (Gradium TTS → mic → Gradium STT → Lovable AI → repeat) runs unchanged.
- "Test with one number" opens a quick dialog to type any phone-style label and starts a browser conversation without consuming a real lead.

## Phase 4 — Wire-through + polish (~2–3 hrs)

- `agentReply` server function gets `whoWeAre` / `whatWeDo` from `company_profile` and `persona` from `sales_personas.prompt` (looked up via `campaign_id` on the run). No client-side prompt changes.
- Conversation page (`conversations.$runId.tsx`) gets a small header chip: "Campaign · Q2 Berlin agencies · Voice · Margot" so you know which call you're in.
- Run detail page (`runs.$runId.tsx`) keeps the Gemini "Generate report" button as-is, plus a back-link to its campaign and a one-click "Mark lead as Scheduled / Called" action that updates `leads.status`.
- Keep the existing "Operate → Flows" pages working untouched as a power-user view (so nothing currently in your DB breaks).

## What stays exactly the same

- `src/lib/gradium.functions.ts` — all four server functions (`gradiumTTS`, `gradiumSTT`, `agentReply`, `generateReport`) untouched. They just receive the new fields from the new tables.
- `src/integrations/supabase/client.ts`, auth flow, login page, root layout — untouched.
- All existing `runs` data — preserved; the new `campaign_id` / `lead_id` columns are nullable.
- Design tokens in `styles.css` — already match the mockups; no token changes needed.

## What I'd flag as the only real risks

1. **Sidebar counts on every page** — solved by one shared hook with `count: 'exact', head: true` queries (cheap).
2. **Seeding 8 default personas per user** — done in the `handle_new_user()` trigger alongside the existing profile insert; idempotent.
3. **The "Now dialing" card needing realtime** — already have a Supabase realtime channel on `runs` from the current dashboard; reuse it.

## Suggested order if you want to ship in stages

1. **Day 1 morning**: Phase 1 (sidebar) + Phase 2 (migration). The app already looks 60% closer to the mockups after just the sidebar swap.
2. **Day 1 afternoon**: Dashboard + Leads + Company pages (the three "static" pages).
3. **Day 2 morning**: Sales personas page + seed data.
4. **Day 2 afternoon**: Campaigns page (the most complex one) + wire-through to the existing conversation/report flow.

If you want to compress further, **Phase 1 + the Campaigns page alone** (~half a day) gives you the most visual impact and keeps everything else as-is.