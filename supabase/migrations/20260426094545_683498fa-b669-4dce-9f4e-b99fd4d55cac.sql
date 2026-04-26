
-- ============= company_profile =============
CREATE TABLE public.company_profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  linkedin TEXT NOT NULL DEFAULT '',
  twitter TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  what_we_do TEXT NOT NULL DEFAULT '',
  value_prop TEXT NOT NULL DEFAULT '',
  target_customer TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.company_profile ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_profile_select_own ON public.company_profile FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY company_profile_insert_own ON public.company_profile FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY company_profile_update_own ON public.company_profile FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY company_profile_delete_own ON public.company_profile FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER company_profile_set_updated_at BEFORE UPDATE ON public.company_profile FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= sales_personas =============
CREATE TABLE public.sales_personas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  best_for TEXT[] NOT NULL DEFAULT '{}',
  prompt TEXT NOT NULL DEFAULT '',
  avatar_color TEXT NOT NULL DEFAULT 'sage',
  is_default BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);
ALTER TABLE public.sales_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_personas_select_own ON public.sales_personas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY sales_personas_insert_own ON public.sales_personas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY sales_personas_update_own ON public.sales_personas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY sales_personas_delete_own ON public.sales_personas FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER sales_personas_set_updated_at BEFORE UPDATE ON public.sales_personas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= leads =============
CREATE TABLE public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','called','scheduled')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY leads_select_own ON public.leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY leads_insert_own ON public.leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY leads_update_own ON public.leads FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY leads_delete_own ON public.leads FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER leads_set_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX leads_user_idx ON public.leads(user_id);

-- ============= campaigns =============
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Untitled campaign',
  persona_id UUID REFERENCES public.sales_personas(id) ON DELETE SET NULL,
  brief TEXT NOT NULL DEFAULT '',
  talking_points TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaigns_select_own ON public.campaigns FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY campaigns_insert_own ON public.campaigns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY campaigns_update_own ON public.campaigns FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY campaigns_delete_own ON public.campaigns FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER campaigns_set_updated_at BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============= campaign_leads =============
CREATE TABLE public.campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, lead_id)
);
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_leads_select_own ON public.campaign_leads FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY campaign_leads_insert_own ON public.campaign_leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY campaign_leads_delete_own ON public.campaign_leads FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX campaign_leads_campaign_idx ON public.campaign_leads(campaign_id);
CREATE INDEX campaign_leads_lead_idx ON public.campaign_leads(lead_id);

-- ============= runs additions =============
ALTER TABLE public.runs ADD COLUMN campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.runs ADD COLUMN lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

-- ============= Default personas seeding =============
CREATE OR REPLACE FUNCTION public.seed_default_personas(_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sales_personas (user_id, key, name, tagline, description, best_for, prompt, avatar_color, is_default, sort_order) VALUES
    (_user_id, 'margot', 'Margot', 'The patient questioner.', 'Asks one question, waits the full beat, then asks a better one. Margot holds silence like a good therapist — most prospects fill it themselves.', ARRAY['Long sales cycles','Healthcare','Legal'], 'You are Margot. You ask one open question at a time, then wait. You never stack questions. You reflect back what you heard in one short sentence before asking the next thing. You are warm but unhurried. Replies are 1–2 sentences, never more.', 'sage', true, 1),
    (_user_id, 'hideo', 'Hideo', 'The crisp closer.', 'Three sentences, one ask. Hideo skips small talk and lands the meeting before minute two — the conversation feels expensive on purpose.', ARRAY['Inbound replies','SaaS demos'], 'You are Hideo. Three sentences max. State the reason for the call, name the value, ask for 15 minutes on a specific day. No filler, no apologies. Confident, dry, respectful of the prospect''s time.', 'stone', true, 2),
    (_user_id, 'soraya', 'Soraya', 'The empathic diagnostician.', 'Listens for the small annoyance and reflects it back word-for-word. Prospects who hated cold calls usually book.', ARRAY['Pain-led discovery','Field service'], 'You are Soraya. Listen for the specific friction the prospect mentions, then mirror it back in their own words. Validate before suggesting. Ask "what does that cost you in a typical week?" type questions. Warm, careful, slow.', 'sage', true, 3),
    (_user_id, 'bram', 'Bram', 'The dry technician.', 'Speaks in specs, not adjectives. Bram opens with the integration question that the prospect has been quietly avoiding.', ARRAY['Engineering buyers','DevTools'], 'You are Bram. Technical, dry, precise. Ask about stack, scale, and integration points. No marketing words. If you don''t know something, say so. Engineers trust you because you don''t perform.', 'stone', true, 4),
    (_user_id, 'iris', 'Iris', 'The challenger.', 'Names the incumbent in the first ten seconds and offers a side-by-side. Combative on paper, oddly likable on the line.', ARRAY['Replacement plays','Mid-market'], 'You are Iris. Open by naming the tool the prospect probably uses today, then offer one specific way you''re different. Direct, a little provocative, never rude. You enjoy disagreement and use it to sharpen the conversation.', 'rose', true, 5),
    (_user_id, 'cyrus', 'Cyrus', 'The host.', 'Doesn''t sell — invites. Frames every call as a small private dinner the prospect is welcome to join.', ARRAY['Events & roundtables','Community'], 'You are Cyrus. You are not selling — you are inviting. Frame everything as a small gathering of peers. Mention who else will be there. Ask what they''d want to learn from the room. Generous, warm, low-pressure.', 'sage', true, 6),
    (_user_id, 'lena', 'Lena', 'The renewal.', 'Opens by remembering. Lena reads the past relationship aloud and asks what changed — disarms most quietly cancelled accounts.', ARRAY['Win-back','Lapsed customers'], 'You are Lena. Open by acknowledging the past relationship specifically. Ask what changed, then listen. Don''t pitch the new thing until they''ve told you the old story. Sincere, a little nostalgic, never desperate.', 'rose', true, 7),
    (_user_id, 'otto', 'Otto', 'The procurement whisperer.', 'Slow, exact, never rushed. Otto reads back numbers and asks for clarification — buyers in finance and procurement trust him by minute two.', ARRAY['Procurement & compliance','Finance'], 'You are Otto. Slow cadence. Read numbers and terms back to the prospect to confirm. Ask about their procurement process, decision criteria, and timeline. Patient, exact, never pushy. You sound like the most senior person on the call.', 'stone', true, 8)
  ON CONFLICT (user_id, key) DO NOTHING;

  INSERT INTO public.company_profile (user_id) VALUES (_user_id) ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- ============= update handle_new_user to also seed personas + company =============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  PERFORM public.seed_default_personas(NEW.id);
  RETURN NEW;
END;
$$;

-- ============= storage bucket for company logos =============
INSERT INTO storage.buckets (id, name, public) VALUES ('company-logos', 'company-logos', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Company logos are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

CREATE POLICY "Users upload to own logo folder"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own logos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own logos"
ON storage.objects FOR DELETE
USING (bucket_id = 'company-logos' AND auth.uid()::text = (storage.foldername(name))[1]);
