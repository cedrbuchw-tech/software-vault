-- ============================================================================
--  softwarevault.dev — complete database schema
--  Run this ONCE in the Supabase SQL editor (Dashboard → SQL Editor → New query).
--  Safe to re-run: every statement is idempotent. Covers programs, settings,
--  user accounts (profiles) and per-account likes.
-- ============================================================================

-- ── 1. programs ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  ver TEXT,
  cat TEXT,
  url TEXT,
  fileurl TEXT,
  filename TEXT,
  filesize BIGINT,
  downloads JSONB DEFAULT '{}'::jsonb,
  os TEXT[] DEFAULT ARRAY[]::TEXT[],
  coverimage TEXT,
  screenshots TEXT[] DEFAULT ARRAY[]::TEXT[],
  dl INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous read" ON public.programs;
CREATE POLICY "Allow anonymous read" ON public.programs
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow authenticated write" ON public.programs;
CREATE POLICY "Allow authenticated write" ON public.programs
  FOR ALL USING (true) WITH CHECK (true);

-- ── 2. settings (admin hash + site settings) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- ── 3. profiles (one row per user account, auto-created on signup) ──────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text UNIQUE,
  is_admin    boolean DEFAULT false,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
CREATE POLICY "profiles_read_all" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- allow a signed-in user to create their own profile row (the signup trigger
-- normally does this, but this lets the client upsert their username safely too)
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- If no admin exists yet, make the very first created user the admin.
  INSERT INTO public.profiles (id, username, is_admin)
  VALUES (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username',''), split_part(new.email,'@',1)),
    (SELECT NOT EXISTS(SELECT 1 FROM public.profiles WHERE is_admin = true))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 4. likes (per-account likes; trigger keeps programs.likes in sync) ──────
CREATE TABLE IF NOT EXISTS public.likes (
  user_id    uuid REFERENCES auth.users(id)      ON DELETE CASCADE,
  program_id text REFERENCES public.programs(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, program_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "likes_select_own" ON public.likes;
CREATE POLICY "likes_select_own" ON public.likes FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "likes_insert_own" ON public.likes;
CREATE POLICY "likes_insert_own" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "likes_delete_own" ON public.likes;
CREATE POLICY "likes_delete_own" ON public.likes FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.bump_like_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.programs SET likes = coalesce(likes,0) + 1 WHERE id = new.program_id;
    RETURN new;
  ELSE
    UPDATE public.programs SET likes = greatest(coalesce(likes,0) - 1, 0) WHERE id = old.program_id;
    RETURN old;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS likes_count_ins ON public.likes;
CREATE TRIGGER likes_count_ins AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_like_count();
DROP TRIGGER IF EXISTS likes_count_del ON public.likes;
CREATE TRIGGER likes_count_del AFTER DELETE ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.bump_like_count();


-- ── 6. library (per-account "My Apps"; what the launcher syncs) ─────────────
CREATE TABLE IF NOT EXISTS public.library (
  user_id    uuid REFERENCES auth.users(id)      ON DELETE CASCADE,
  program_id text REFERENCES public.programs(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, program_id)
);

ALTER TABLE public.library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "library_select_own" ON public.library;
CREATE POLICY "library_select_own" ON public.library FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "library_insert_own" ON public.library;
CREATE POLICY "library_insert_own" ON public.library FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "library_delete_own" ON public.library;
CREATE POLICY "library_delete_own" ON public.library FOR DELETE USING (auth.uid() = user_id);
