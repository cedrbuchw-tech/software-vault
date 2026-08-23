-- Make an account an admin — run in the Supabase SQL editor. Safe to re-run.
-- ===========================================================================
-- The guaranteed route into the admin panel. It touches the database directly,
-- so it works no matter what the site or the environment variables are doing.
--
-- Everything that decides who sees the panel reads ONE thing:
-- public.profiles.is_admin. /api/admin reads it, lib/api_auth.js reads it, and
-- the Users tab writes it. ADMIN_EMAILS is only an override layered on top.
--
-- Change the address on the marked line, then run the whole file.


-- ── 1. Make sure the column even exists ────────────────────────────────────
-- If SETUP_SUPABASE.sql was never run (or was run before this column was added)
-- then every is_admin lookup fails, and no one can be an admin at all.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;


-- ── 2. Make sure a profile row exists for every account ────────────────────
-- The row is normally created by a trigger on signup. Accounts made before that
-- trigger existed have none, and an account with no profile row can never be
-- given anything.

INSERT INTO public.profiles (id, username)
SELECT u.id, split_part(u.email, '@', 1)
  FROM auth.users u
 WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;


-- ── 3. Promote the account ─────────────────────────────────────────────────
--                    ↓↓↓ put your address here ↓↓↓
UPDATE public.profiles
   SET is_admin = true
 WHERE id IN (SELECT id FROM auth.users
               WHERE lower(email) = lower('cedrbuchw@gmail.com'));


-- ── 4. Read the answer ─────────────────────────────────────────────────────
-- `is_admin` must be true on your row. If NO ROWS come back at all, the address
-- has no account — check for a typo, or which address you actually signed up
-- with (the Account dialog on the site shows it under your username).

SELECT u.email,
       p.username,
       p.is_admin,
       u.created_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
 ORDER BY p.is_admin DESC NULLS LAST, u.created_at;


-- ── Afterwards ─────────────────────────────────────────────────────────────
-- Reload the site. The Admin button appears next to the theme toggle, and the
-- Users tab inside the panel can hand the same rights to anyone else without
-- ever coming back here.
