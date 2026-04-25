ALTER TABLE public.runs
ADD COLUMN IF NOT EXISTS report jsonb,
ADD COLUMN IF NOT EXISTS report_generated_at timestamp with time zone;