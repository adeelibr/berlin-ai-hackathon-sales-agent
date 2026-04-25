
ALTER TABLE public.flows
  DROP COLUMN IF EXISTS phone_numbers,
  DROP COLUMN IF EXISTS voice,
  DROP COLUMN IF EXISTS ac_post_enhance,
  DROP COLUMN IF EXISTS telli_agent_id,
  DROP COLUMN IF EXISTS hermozi_knowledge;

ALTER TABLE public.flows
  ADD COLUMN IF NOT EXISTS agent_persona text NOT NULL DEFAULT '';

ALTER TABLE public.runs
  DROP COLUMN IF EXISTS recording_url,
  DROP COLUMN IF EXISTS cleaned_recording_url,
  DROP COLUMN IF EXISTS telli_call_id,
  DROP COLUMN IF EXISTS generated_script,
  DROP COLUMN IF EXISTS duration_seconds,
  DROP COLUMN IF EXISTS phone_number;
