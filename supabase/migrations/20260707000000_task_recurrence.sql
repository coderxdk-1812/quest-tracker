-- Recurring tasks (spec: quick-capture / recurring-tasks / timetable-nudges / perfect-week batch).
-- Nullable jsonb: { "type": "daily" | "weekly" | "weekdays", "days"?: number[] (Mon=0..Sun=6) }.
-- A task's recurrence is cleared once its next occurrence has been spawned — only the
-- active head of a recurring chain carries a non-null value at any given time, so this
-- column alone is enough to know whether a task is still "live" for auto-renewal.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence jsonb;
