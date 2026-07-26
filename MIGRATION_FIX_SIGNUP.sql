-- Fix: "Database error saving new user" on signup
-- ---------------------------------------------------------------------------
-- Run this once in the Supabase SQL editor. Safe to run again.
--
-- WHAT WENT WRONG
-- `profiles.username` is UNIQUE, but the signup trigger only guarded against a
-- conflict on `id`:
--
--     INSERT INTO public.profiles (id, username, is_admin) VALUES (...)
--     ON CONFLICT (id) DO NOTHING;
--
-- So whenever the chosen username (or the part before the "@" of the email) was
-- already taken, the INSERT raised a unique violation. The trigger runs inside
-- the signup transaction, so the whole account creation was rolled back and
-- Supabase reported the generic "Database error saving new user".
--
-- Leftover rows made it worse: a profile whose auth user no longer exists still
-- occupies its username.
--
-- THE FIX
--   1. clean up orphaned profiles (no matching auth user)
--   2. a trigger that finds a free username instead of failing, and that can
--      never abort a signup again


-- ── 1. remove profiles whose auth user is gone ─────────────────────────────
DELETE FROM public.profiles p
 WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);


-- ── 2. a signup trigger that cannot break signup ───────────────────────────
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

  -- username is UNIQUE — if it's taken, append a number rather than failing
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE username = candidate) LOOP
    suffix    := suffix + 1;
    candidate := base_name || suffix::text;
    EXIT WHEN suffix > 9999;
  END LOOP;

  INSERT INTO public.profiles (id, username, is_admin)
  VALUES (
    new.id,
    candidate,
    (SELECT NOT EXISTS(SELECT 1 FROM public.profiles WHERE is_admin = true))
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;

EXCEPTION WHEN OTHERS THEN
  -- Creating a profile must never stop someone from creating an account. If
  -- anything unexpected happens, log it and let the signup succeed; the profile
  -- can be repaired afterwards (the client upserts its username on login too).
  RAISE WARNING 'handle_new_user failed for %: %', new.id, SQLERRM;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── 3. check afterwards (optional) ─────────────────────────────────────────
-- Any profile without an account (should return no rows):
--   SELECT p.id, p.username FROM public.profiles p
--    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);
--
-- Duplicate usernames (should return no rows):
--   SELECT username, count(*) FROM public.profiles
--    GROUP BY username HAVING count(*) > 1;
