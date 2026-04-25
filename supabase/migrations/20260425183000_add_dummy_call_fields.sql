ALTER TABLE public.runs
ADD COLUMN IF NOT EXISTS call_transport text NOT NULL DEFAULT 'twilio',
ADD COLUMN IF NOT EXISTS dummy_call_id text,
ADD COLUMN IF NOT EXISTS dummy_call_status text,
ADD COLUMN IF NOT EXISTS dummy_device_session_id text;

CREATE INDEX IF NOT EXISTS runs_dummy_call_id_idx ON public.runs(dummy_call_id);
