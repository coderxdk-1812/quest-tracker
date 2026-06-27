
-- profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS user_id UUID GENERATED ALWAYS AS (id) STORED,
  ADD COLUMN IF NOT EXISTS username TEXT,
  ADD COLUMN IF NOT EXISTS show_xp BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_level BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_streak BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_tasks_completed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_badges BOOLEAN NOT NULL DEFAULT true;

-- game_state
ALTER TABLE public.game_state
  ADD COLUMN IF NOT EXISTS purchased_items TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS active_boosts JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS active_theme TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS equipped_badge TEXT,
  ADD COLUMN IF NOT EXISTS earned_badges TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS dark_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_tokens_used INTEGER NOT NULL DEFAULT 0;

-- task_completions
ALTER TABLE public.task_completions
  ADD COLUMN IF NOT EXISTS xp_granted INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS coins_granted INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reversed BOOLEAN NOT NULL DEFAULT false;

-- timetable_entries
ALTER TABLE public.timetable_entries
  ADD COLUMN IF NOT EXISTS day INTEGER;

-- daily_quests
ALTER TABLE public.daily_quests
  ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.daily_quests
  DROP CONSTRAINT IF EXISTS daily_quests_user_unique;
ALTER TABLE public.daily_quests
  ADD CONSTRAINT daily_quests_user_unique UNIQUE (user_id);

-- Update signup trigger to also seed username + a game_state row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1))
  );
  INSERT INTO public.game_state (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

-- Tighten SECURITY DEFINER: only the auth trigger should call it
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
