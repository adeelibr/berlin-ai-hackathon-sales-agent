-- profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- auto create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- flows
CREATE TABLE public.flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled flow',
  who_we_are TEXT NOT NULL DEFAULT '',
  what_we_do TEXT NOT NULL DEFAULT '',
  hermozi_knowledge TEXT NOT NULL DEFAULT '',
  phone_numbers TEXT NOT NULL DEFAULT '',
  voice TEXT NOT NULL DEFAULT 'default',
  ac_pre_enhance BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.flows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flows_select_own" ON public.flows FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "flows_insert_own" ON public.flows FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "flows_update_own" ON public.flows FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "flows_delete_own" ON public.flows FOR DELETE USING (auth.uid() = user_id);
CREATE TRIGGER flows_updated_at BEFORE UPDATE ON public.flows FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX flows_user_id_idx ON public.flows(user_id, updated_at DESC);

-- runs
CREATE TABLE public.runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.flows(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  generated_script TEXT,
  transcript TEXT,
  recording_url TEXT,
  cleaned_recording_url TEXT,
  duration_seconds INTEGER,
  telli_call_id TEXT,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "runs_select_own" ON public.runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "runs_insert_own" ON public.runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "runs_update_own" ON public.runs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "runs_delete_own" ON public.runs FOR DELETE USING (auth.uid() = user_id);
CREATE INDEX runs_user_id_idx ON public.runs(user_id, started_at DESC);
CREATE INDEX runs_flow_id_idx ON public.runs(flow_id, started_at DESC);
CREATE INDEX runs_telli_call_id_idx ON public.runs(telli_call_id);

-- enable realtime for runs (live status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.runs;