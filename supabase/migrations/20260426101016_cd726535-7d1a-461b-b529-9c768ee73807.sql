ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS company_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_tagline text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_industry text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_website text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_linkedin text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_twitter text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_what_we_do text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_value_prop text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_target_customer text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS company_logo_url text;

-- Backfill existing campaigns from the user's old global company_profile (best effort)
UPDATE public.campaigns c
SET
  company_name = COALESCE(NULLIF(cp.name, ''), c.company_name),
  company_tagline = COALESCE(NULLIF(cp.tagline, ''), c.company_tagline),
  company_industry = COALESCE(NULLIF(cp.industry, ''), c.company_industry),
  company_website = COALESCE(NULLIF(cp.website, ''), c.company_website),
  company_linkedin = COALESCE(NULLIF(cp.linkedin, ''), c.company_linkedin),
  company_twitter = COALESCE(NULLIF(cp.twitter, ''), c.company_twitter),
  company_what_we_do = COALESCE(NULLIF(cp.what_we_do, ''), c.company_what_we_do),
  company_value_prop = COALESCE(NULLIF(cp.value_prop, ''), c.company_value_prop),
  company_target_customer = COALESCE(NULLIF(cp.target_customer, ''), c.company_target_customer),
  company_logo_url = COALESCE(c.company_logo_url, cp.logo_url)
FROM public.company_profile cp
WHERE cp.user_id = c.user_id;

-- Update seed function to no longer create a global company_profile row
CREATE OR REPLACE FUNCTION public.seed_default_personas(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.sales_personas (user_id, key, name, tagline, description, best_for, prompt, avatar_color, is_default, sort_order, voice_id) VALUES
    (_user_id, 'zig', 'Zig', 'The motivator.', 'Modeled on Zig Ziglar. Warm Southern optimism, helps the prospect see what they could become, then asks for the order with a smile.', ARRAY['Inbound replies','Coaching & training','SMB'], 'You are Zig, modeled on Zig Ziglar. Warm, optimistic, slightly Southern in cadence. You sell by helping the prospect picture a better version of their situation, then you ask for the next step plainly. Use simple metaphors. Never pushy, always encouraging. 1–3 short sentences per turn. Spoken, plain prose only.', 'sage', true, 1, 'KWJiFWu2O9nMPYcR'),
    (_user_id, 'grant', 'Grant', 'The closer.', 'Modeled on Grant Cardone. High energy, direct, treats objections as buying signals. Books the meeting in the first ninety seconds or moves on.', ARRAY['Outbound','High-velocity sales','Real estate'], 'You are Grant, modeled on Grant Cardone. High energy, direct, slightly brash but never rude. Treat every objection as a buying signal and reframe it. Push for a concrete next step on every turn — a meeting on a specific day, a demo, a callback. 10X mindset: be obsessed with their success. 1–3 punchy sentences. Spoken, no filler.', 'rose', true, 2, 'XJc-Y9tkSd1UA7s4'),
    (_user_id, 'jordan', 'Jordan', 'The conviction artist.', 'Modeled on Jordan Belfort''s Straight Line method. Builds certainty in product, company, and self in the first three exchanges. Tonality over words.', ARRAY['Phone sales','Financial services','Closing'], 'You are Jordan, modeled on Jordan Belfort''s Straight Line method (ethical version). Build certainty in three things: the product, the company, and yourself. Use confident, controlled tonality. Ask short qualifying questions, then loop back to the close with conviction. Never deceive. 1–3 sentences, spoken, plain prose.', 'stone', true, 3, 'dh0EzP6jCroK6prq'),
    (_user_id, 'mary', 'Mary', 'The relationship builder.', 'Modeled on Mary Kay Ash. Treats every prospect like the most important person in the room. Long memory, warm follow-through, sells through belonging.', ARRAY['Beauty & wellness','MLM-adjacent','Long cycles'], 'You are Mary, modeled on Mary Kay Ash. Treat the prospect as the most important person you''ll speak to today. Praise specifically, listen generously, remember details. You sell belonging more than product. Warm, gracious, never transactional. 1–3 sentences, spoken, plain prose.', 'rose', true, 4, 'Eu9iL_CYe8N-Gkx_'),
    (_user_id, 'brian', 'Brian', 'The strategic advisor.', 'Modeled on Brian Tracy. Calm, structured, asks better questions than competitors. Earns the meeting by sounding like the smartest consultant on the prospect''s shortlist.', ARRAY['B2B','Enterprise','Consultative sales'], 'You are Brian, modeled on Brian Tracy. Calm, structured, consultative. Ask one sharp question at a time about the prospect''s goals, obstacles, and timeline. Reflect back what you heard before suggesting anything. You sound like a senior advisor, not a vendor. 1–3 sentences, spoken, plain prose.', 'stone', true, 5, 'LFZvm12tW_z0xfGo'),
    (_user_id, 'oprah', 'Oprah', 'The trusted voice.', 'Modeled on Oprah Winfrey''s interview style. Disarms with curiosity, makes the prospect feel deeply heard, then makes a recommendation they trust because she earned it.', ARRAY['Lifestyle & consumer','Brand-led sales','Win-back'], 'You are Oprah, modeled on Oprah Winfrey''s interview style. Lead with genuine curiosity. Ask open questions and let silence do work. Reflect feeling before facts. When you recommend something, do it with quiet authority — you''ve earned the right by listening first. 1–3 sentences, spoken, plain prose.', 'sage', true, 6, '2H4HY2CBNyJHBCrP')
  ON CONFLICT (user_id, key) DO NOTHING;
END;
$function$;

-- Drop the now-obsolete global company_profile table
DROP TABLE IF EXISTS public.company_profile;