-- Site settings storage — run once in the Supabase SQL editor. Safe to re-run.
-- ===========================================================================
-- The announcement banner, the support/donation block, the hero subtitle and
-- the secret-download config all live as ONE json blob in public.settings under
-- the key 'site_settings', written by POST /api/settings and read by everyone
-- through GET /api/settings.
--
-- SETUP_SUPABASE.sql already declares this table, but that file was clearly
-- never applied in full here — public.programs was missing its `downloads`
-- column for the same reason. If the table is absent, saving a banner appears
-- to work (it goes into the admin's own IndexedDB) while reaching precisely
-- nobody else. This creates it if it is missing and changes nothing if it isn't.

CREATE TABLE IF NOT EXISTS public.settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Only the service role touches this table, and the service role bypasses RLS.
-- Turning RLS on with no policies denies anon/authenticated outright, so the
-- values can never be read or written straight from a browser with the anon
-- key — everything has to go through /api/settings, which checks for an admin.
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.settings FROM anon, authenticated;


-- ── Check afterwards ───────────────────────────────────────────────────────
-- The table exists:
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'settings';
--
-- And, once you have saved a banner from Admin → Site:
--   SELECT key, left(value, 120) AS preview FROM public.settings;
--
-- 'site_settings' should be listed. If it is not, the save never reached the
-- database and the admin panel will now say so instead of failing quietly.
