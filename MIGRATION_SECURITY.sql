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

REVOKE SELECT (two_fa_secret, two_fa_secret_temp)
  ON public.profiles FROM anon, authenticated;

-- Keep the rest of the profile readable (usernames, admin flag) by granting the
-- remaining columns back explicitly.
GRANT SELECT (id, username, is_admin, created_at, two_fa_enabled)
  ON public.profiles TO anon, authenticated;

-- Nobody but the service role should be able to flip the admin bit or write a
-- secret. Users may still update their own row (the username), enforced by the
-- existing profiles_update_own policy.
REVOKE UPDATE (is_admin, two_fa_enabled, two_fa_secret, two_fa_secret_temp)
  ON public.profiles FROM anon, authenticated;
GRANT UPDATE (username) ON public.profiles TO authenticated;


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
