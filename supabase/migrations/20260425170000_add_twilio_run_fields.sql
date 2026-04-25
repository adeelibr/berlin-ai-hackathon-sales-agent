ALTER TABLE public.runs
ADD COLUMN IF NOT EXISTS target_phone_number text,
ADD COLUMN IF NOT EXISTS twilio_call_sid text,
ADD COLUMN IF NOT EXISTS twilio_stream_sid text,
ADD COLUMN IF NOT EXISTS twilio_call_status text;

CREATE INDEX IF NOT EXISTS runs_twilio_call_sid_idx ON public.runs(twilio_call_sid);
