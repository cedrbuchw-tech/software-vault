-- ============================================================================
-- programs
-- ============================================================================
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
  downloads JSONB DEFAULT '{}'::jsonb,            -- per-OS build links
  dl_by_month JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"2026-08": 42} for the monthly report
  os TEXT[] DEFAULT ARRAY[]::TEXT[],
  coverimage TEXT,
  screenshots TEXT[] DEFAULT ARRAY[]::TEXT[],
  dl INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  featured BOOLEAN DEFAULT false,
  date TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- for databases created before these columns existed
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS downloads   jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS dl_by_month jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- Read is public; writes go through the API, which uses the service role and
-- bypasses RLS. An earlier "FOR ALL USING (true)" policy granted write access
-- to anyone holding the anon key, which ships in the browser.
DROP POLICY IF EXISTS "Allow authenticated write" ON public.programs;
DROP POLICY IF EXISTS "Allow anonymous read" ON public.programs;
DROP POLICY IF EXISTS "programs_read_all" ON public.programs;
CREATE POLICY "programs_read_all" ON public.programs
  FOR SELECT USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.programs FROM anon, authenticated;

-- bumps the total and the current month in one statement
CREATE OR REPLACE FUNCTION public.increment_program_downloads(pid TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
  month_key TEXT := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM');
BEGIN
  UPDATE public.programs
     SET dl = COALESCE(dl, 0) + 1,
         dl_by_month = jsonb_set(
           COALESCE(dl_by_month, '{}'::jsonb),
           ARRAY[month_key],
           to_jsonb(COALESCE((dl_by_month ->> month_key)::int, 0) + 1),
           true)
   WHERE id = pid
  RETURNING dl INTO new_count;
  RETURN new_count;
END;
$$;


-- ============================================================================
-- settings — banner, support block, hero subtitle and secret download config,
-- as one JSON blob under the key 'site_settings'
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Only the service role touches this, and it bypasses RLS. Enabling RLS with no
-- policies denies anon and authenticated outright, so the values can never be
-- read or written straight from a browser holding the anon key.
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.settings FROM anon, authenticated;


-- ============================================================================
-- profiles — one row per account, created by the signup trigger below
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text UNIQUE,
  is_admin    boolean NOT NULL DEFAULT false,
  avatar_url  text,
  email_2fa_enabled boolean NOT NULL DEFAULT false,
  prefs       jsonb,                       -- appearance, theme and language
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS avatar_url        text,
  ADD COLUMN IF NOT EXISTS email_2fa_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prefs             jsonb;

-- TOTP lived here before the switch to Supabase's own MFA
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS two_fa_enabled,
  DROP COLUMN IF EXISTS two_fa_secret,
  DROP COLUMN IF EXISTS two_fa_secret_temp;
DROP INDEX IF EXISTS public.idx_profiles_two_fa_enabled;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
CREATE POLICY "profiles_read_all" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- username is UNIQUE, so a taken name gets a numeric suffix rather than raising
-- inside the signup transaction and rolling the whole account creation back.
-- The exception handler is there for the same reason: a profile can be repaired
-- afterwards, a failed signup cannot.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_name text;
  candidate text;
  suffix    int := 0;
BEGIN
  base_name := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    split_part(new.email, '@', 1),
    'user'
  );
  candidate := base_name;

  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    suffix    := suffix + 1;
    candidate := base_name || suffix::text;
    EXIT WHEN suffix > 9999;
  END LOOP;

  -- the first account to exist becomes the admin
  INSERT INTO public.profiles (id, username, is_admin)
  VALUES (
    new.id,
    candidate,
    (SELECT NOT EXISTS(SELECT 1 FROM public.profiles WHERE is_admin = true))
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', new.id, SQLERRM;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- a profile whose auth user is gone still occupies its unique username
DELETE FROM public.profiles p
 WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);

-- backfill accounts created before the trigger existed
INSERT INTO public.profiles (id, username)
SELECT u.id, split_part(u.email, '@', 1)
  FROM auth.users u
 WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;


-- ============================================================================
-- likes — per account; the trigger keeps programs.likes in sync
-- ============================================================================
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


-- ============================================================================
-- library — per-account "My Apps", which the launcher syncs
-- ============================================================================
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


-- ============================================================================
-- login_codes — the 6-character email second factor
-- ============================================================================
-- Session tokens are minted at the password check and parked here until the
-- code is confirmed, so they are never handed to the browser first.
CREATE TABLE IF NOT EXISTS public.login_codes (
  ticket        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash     text NOT NULL,
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  attempts      int  NOT NULL DEFAULT 0,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_codes_expires
  ON public.login_codes(expires_at);

ALTER TABLE public.login_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_codes FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.purge_expired_login_codes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.login_codes WHERE expires_at < now();
$$;


-- ============================================================================
-- avatars storage bucket
-- ============================================================================
-- Public read: avatars appear next to usernames, so they must be fetchable
-- without a token. Every file lives under a folder named after the owner's user
-- id, and the policies compare that first path segment against auth.uid().
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "avatars_read_all" ON storage.objects;
CREATE POLICY "avatars_read_all" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars'
              AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars'
         AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars'
         AND (storage.foldername(name))[1] = auth.uid()::text);


-- ============================================================================
-- column grants on profiles — MUST BE LAST
-- ============================================================================
-- RLS cannot filter columns, so privileges are set at column level instead.
-- A column-level REVOKE is a no-op while the role still holds the privilege at
-- table level, and Supabase grants that by default, so the table grant goes
-- first and the safe columns are granted back. Built from the columns that
-- actually exist, which is why this runs after every ALTER TABLE above.
--
-- prefs is deliberately absent from both lists: /api/prefs reads and writes it
-- with the service role, taking the account id from the verified bearer token.
DO $$
DECLARE
  readable text[] := ARRAY['id', 'username', 'avatar_url', 'is_admin',
                           'created_at', 'email_2fa_enabled'];
  -- never is_admin (self promotion) and never a 2FA flag (switching off your
  -- own second factor)
  writable text[] := ARRAY['username', 'avatar_url'];
  read_cols  text;
  write_cols text;
BEGIN
  REVOKE SELECT, UPDATE ON public.profiles FROM anon, authenticated;

  SELECT string_agg(quote_ident(column_name), ', ')
    INTO read_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'profiles'
     AND column_name = ANY(readable);

  IF read_cols IS NOT NULL THEN
    EXECUTE format('GRANT SELECT (%s) ON public.profiles TO anon, authenticated', read_cols);
    RAISE NOTICE 'profiles readable: %', read_cols;
  END IF;

  SELECT string_agg(quote_ident(column_name), ', ')
    INTO write_cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'profiles'
     AND column_name = ANY(writable);

  IF write_cols IS NOT NULL THEN
    EXECUTE format('GRANT UPDATE (%s) ON public.profiles TO authenticated', write_cols);
    RAISE NOTICE 'profiles writable by owner: %', write_cols;
  END IF;
END $$;


-- ============================================================================
-- checks
-- ============================================================================
-- Write policies left on programs (expect only the read policy):
--   SELECT policyname, cmd FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'programs';
--
-- Column privileges for the public roles on profiles (prefs must NOT appear):
--   SELECT grantee, column_name, privilege_type
--     FROM information_schema.column_privileges
--    WHERE table_name = 'profiles' AND grantee IN ('anon','authenticated')
--    ORDER BY grantee, column_name;
--
-- Who is an admin:
--   SELECT u.email, p.username, p.is_admin
--     FROM auth.users u LEFT JOIN public.profiles p ON p.id = u.id
--    ORDER BY p.is_admin DESC NULLS LAST, u.created_at;
--
-- To grant admin by hand (the ADMIN_EMAILS environment variable does this too):
--   UPDATE public.profiles SET is_admin = true
--    WHERE id IN (SELECT id FROM auth.users WHERE lower(email) = lower('you@example.com'));
