-- Email-code two-factor auth — run once in the Supabase SQL editor.
-- ===========================================================================
-- Accounts can now pick their second factor:
--
--   * Authenticator app (TOTP) — handled entirely by Supabase's own MFA. The
--     auth server enforces it; nothing here is involved.
--   * Email code — handled by this project, because Supabase has no email
--     factor. That is what the table below is for.
--
-- HONEST LIMITATION, please read:
-- The email code is checked by our login route, which only hands over the
-- session after a correct code. But the Supabase password endpoint stays open
-- to the internet: someone who knows an account's password can call it directly
-- and get a session without ever seeing a code. The email option is therefore
-- a meaningful speed bump for the website, NOT the equal of the authenticator
-- app. Anyone who wants real enforcement should choose the app.

-- which accounts use the email code (the app factor lives in auth.mfa_factors)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_2fa_enabled boolean NOT NULL DEFAULT false;

-- users must not be able to switch their own second factor off by writing this
-- column directly — it is changed only through the API with the service role
REVOKE UPDATE (email_2fa_enabled) ON public.profiles FROM anon, authenticated;


-- Pending logins: one short-lived row per sign-in that still needs a code.
-- It also parks the freshly minted session so it can be handed over only after
-- the code checks out.
CREATE TABLE IF NOT EXISTS public.login_codes (
  ticket        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code_hash     text NOT NULL,          -- sha256, never the code itself
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  attempts      int  NOT NULL DEFAULT 0,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_codes_expires
  ON public.login_codes(expires_at);

-- The table holds live session tokens, so nobody but the service role may read
-- it. RLS is on with NO policies at all, which denies every anon/authenticated
-- request; the service role bypasses RLS and is the only way in.
ALTER TABLE public.login_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.login_codes FROM anon, authenticated;


-- Housekeeping: drop expired rows. Called by the login route, so no scheduler
-- is required.
CREATE OR REPLACE FUNCTION public.purge_expired_login_codes()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.login_codes WHERE expires_at < now();
$$;


-- ── Check afterwards ───────────────────────────────────────────────────────
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'profiles' AND column_name = 'email_2fa_enabled';
--
--   SELECT count(*) FROM public.login_codes;   -- pending logins right now
