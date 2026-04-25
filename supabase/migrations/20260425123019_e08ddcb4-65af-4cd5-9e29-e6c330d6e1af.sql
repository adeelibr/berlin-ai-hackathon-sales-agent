-- 1. Add telli_agent_id, replace ac_pre_enhance with ac_post_enhance
ALTER TABLE public.flows
  ADD COLUMN IF NOT EXISTS telli_agent_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ac_post_enhance boolean NOT NULL DEFAULT true;

ALTER TABLE public.flows DROP COLUMN IF EXISTS ac_pre_enhance;

-- 2. Storage bucket for cleaned recordings (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('cleaned-recordings', 'cleaned-recordings', false)
ON CONFLICT (id) DO NOTHING;

-- Users can read their own files (folder = user_id)
CREATE POLICY "cleaned_recordings_select_own"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'cleaned-recordings'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
