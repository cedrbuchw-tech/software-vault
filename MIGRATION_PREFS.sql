ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS prefs jsonb;