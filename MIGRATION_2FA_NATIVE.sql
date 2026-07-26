-- Move 2FA to Supabase's built-in MFA — run once in the Supabase SQL editor.
-- ===========================================================================
-- The site used to roll its own two-factor auth: a TOTP secret stored in
-- public.profiles, checked by our own API routes. That had two fatal problems.
--
--   1. It was never enforced. Signing in only ever needed a password; the flag
--      was read to draw a badge in the profile screen and nothing else. Anyone
--      could ignore the website entirely and call the auth API directly.
--   2. profiles is world-readable, so the secrets were too (fixed separately in
--      MIGRATION_SECURITY.sql, but the design was wrong regardless).
--
-- Supabase's own MFA solves both: the secret never leaves the auth service, and
-- a session only reaches assurance level aal2 by presenting a valid code. The
-- old columns are now dead weight, and dead weight holding secrets is worse
-- than useless.
--
-- ANYONE WHO HAD THE OLD 2FA ENABLED MUST SET IT UP AGAIN — the old secrets
-- cannot be carried over, and are deleted here.

ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS two_fa_enabled,
  DROP COLUMN IF EXISTS two_fa_secret,
  DROP COLUMN IF EXISTS two_fa_secret_temp;

DROP INDEX IF EXISTS public.idx_profiles_two_fa_enabled;


-- ── Optional: enforce the second factor at the database level ──────────────
-- Everything above makes the WEBSITE ask for a code. It does not stop someone
-- who talks to the Supabase API directly with just a password: that still
-- yields a valid (aal1) session, and the policies below only check WHO you are,
-- not HOW strongly you proved it.
--
-- To make the second factor binding for personal data, require aal2 in the
-- policies. READ THE WARNING FIRST.
--
--   ⚠ This will lock out the VaultLaunch launcher for anyone with 2FA enabled.
--     The launcher signs in with a password (aal1) and has no way to answer a
--     TOTP challenge yet, so its library sync would start failing.
--
-- Uncomment only when the launcher can handle MFA, or if you don't use it.
--
-- DROP POLICY IF EXISTS "library_select_own" ON public.library;
-- CREATE POLICY "library_select_own" ON public.library FOR SELECT
--   USING (auth.uid() = user_id AND (auth.jwt()->>'aal') = 'aal2');
--
-- DROP POLICY IF EXISTS "library_insert_own" ON public.library;
-- CREATE POLICY "library_insert_own" ON public.library FOR INSERT
--   WITH CHECK (auth.uid() = user_id AND (auth.jwt()->>'aal') = 'aal2');
--
-- DROP POLICY IF EXISTS "library_delete_own" ON public.library;
-- CREATE POLICY "library_delete_own" ON public.library FOR DELETE
--   USING (auth.uid() = user_id AND (auth.jwt()->>'aal') = 'aal2');


-- ── Check afterwards ───────────────────────────────────────────────────────
-- The old columns should be gone:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'profiles';
--
-- Who has a real factor enrolled (managed by Supabase, read-only for us):
--   SELECT user_id, friendly_name, status, created_at
--     FROM auth.mfa_factors ORDER BY created_at DESC;
