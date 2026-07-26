-- Security hardening — run once in the Supabase SQL editor. Safe to re-run.
-- ===========================================================================
-- Two holes here let anyone with the PUBLIC anon key (it ships in the browser,
-- so treat it as known to everybody) bypass the API entirely and talk straight
-- to the database.


-- ── 1. Anyone could rewrite the catalogue ──────────────────────────────────
-- The policy was named "Allow authenticated write" but was written as:
--
--     FOR ALL USING (true) WITH CHECK (true)
--
-- With no role restriction that grants INSERT/UPDATE/DELETE on public.programs
-- to every visitor, signed in or not. A single request with the anon key could
-- empty or rewrite the whole catalogue.
--
-- Writes belong to the API, which uses the service role and bypasses RLS, so
-- the policy is simply removed. Public read stays.

DROP POLICY IF EXISTS "Allow authenticated write" ON public.programs;

DROP POLICY IF EXISTS "Allow anonymous read" ON public.programs;
-- drop our own one too, otherwise a second run fails with 42710 "already exists"
DROP POLICY IF EXISTS "programs_read_all" ON public.programs;
CREATE POLICY "programs_read_all" ON public.programs
  FOR SELECT USING (true);

-- Belt and braces: even if a policy reappears, the public roles have no write
-- privilege on the table.
REVOKE INSERT, UPDATE, DELETE ON public.programs FROM anon, authenticated;


-- ── 2. Every user's 2FA secret was world-readable ───────────────────────────
-- profiles carries two_fa_secret / two_fa_secret_temp, and the read policy is
--
--     FOR SELECT USING (true)
--
-- so anyone could read every account's TOTP secret and generate valid codes at
-- will — the second factor was decorative. RLS can't filter columns, so the
-- privilege is removed at column level instead. The API reads these with the
-- service role, which is unaffected.

-- IMPORTANT: in PostgreSQL a column-level REVOKE does nothing while the role
-- still holds the privilege at TABLE level — and Supabase grants table-level
-- SELECT/UPDATE on public tables to anon and authenticated by default. So the
-- table-level privilege has to go first, then the harmless columns are granted
-- back one by one. Built from the columns that actually exist, so this file can
-- be run before or after the 2FA migrations, in any order, as often as you like.

DO $$
DECLARE
  readable text[] := ARRAY['id', 'username', 'is_admin', 'created_at',
                           'two_fa_enabled', 'email_2fa_enabled'];
  cols text;
BEGIN
  -- 1. drop the blanket table-level rights
  REVOKE SELECT, UPDATE ON public.profiles FROM anon, authenticated;

  -- 2. hand back only the columns that are safe to read
  SELECT string_agg(quote_ident(column_name), ', ')
    INTO cols
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'profiles'
     AND column_name = ANY(readable);

  IF cols IS NOT NULL THEN
    EXECUTE format('GRANT SELECT (%s) ON public.profiles TO anon, authenticated', cols);
    RAISE NOTICE 'profiles readable columns: %', cols;
  END IF;

  -- 3. the only thing a user may change about their own row is the username.
  --    is_admin and every 2FA column stay service-role only, so nobody can
  --    promote themselves or switch their own second factor off.
  GRANT UPDATE (username) ON public.profiles TO authenticated;
END $$;


-- ── 3. Check afterwards ────────────────────────────────────────────────────
-- Remaining write policies on programs (expect only the read policy):
--   SELECT policyname, cmd FROM pg_policies
--    WHERE schemaname = 'public' AND tablename = 'programs';
--
-- Column privileges for the public roles on profiles (two_fa_secret must NOT
-- appear):
--   SELECT grantee, column_name, privilege_type
--     FROM information_schema.column_privileges
--    WHERE table_name = 'profiles' AND grantee IN ('anon','authenticated')
--    ORDER BY grantee, column_name;
