-- Program columns + per-month download counting — run once. Safe to re-run.
-- ===========================================================================
-- Two separate things were missing from public.programs on this database.
--
-- 1. `downloads` (jsonb) — the per-OS build links, {"win":{...},"mac":{...}}.
--    SETUP_SUPABASE.sql declares it, but this database never got it, so
--    /api/programs could not save a program's download links at all.
--
-- 2. `dl_by_month` (jsonb) — new. The schema only ever kept `dl`, a lifetime
--    total, so "downloads this month" could not be answered from stored data.
--    The monthly report asked `downloads['2026-08']`, which was reading the
--    build-links object and would have returned 0 forever even once the column
--    existed. This adds a real per-month bucket, {"2026-08": 12}.
--
-- Counting starts the moment you run this. Months before today read 0 in the
-- report because that history was never recorded — not because it is broken.


-- ── 1. The columns ─────────────────────────────────────────────────────────
ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS downloads    jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.programs
  ADD COLUMN IF NOT EXISTS dl_by_month  jsonb NOT NULL DEFAULT '{}'::jsonb;


-- ── 2. Count into the month bucket as well as the lifetime total ───────────
-- Same atomic single-row update as before (see MIGRATION_DOWNLOAD_COUNTER.sql)
-- — it now also bumps the bucket for the current month. Still one statement,
-- so two simultaneous downloads cannot lose a count.

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

  RETURN new_count;   -- NULL when no such program
END;
$$;


-- ── 3. Check afterwards ────────────────────────────────────────────────────
-- Both columns must appear:
--   SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'programs'
--      AND column_name IN ('downloads', 'dl_by_month');
--
-- And the counters, once a few downloads have gone through:
--   SELECT name, dl, dl_by_month FROM public.programs ORDER BY dl DESC;
