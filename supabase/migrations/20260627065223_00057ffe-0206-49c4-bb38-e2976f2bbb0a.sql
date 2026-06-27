
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS task_links JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS task_durations JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS saved_subjects JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notification_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.task_completions
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;
