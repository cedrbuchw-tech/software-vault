-- Download counter (needed so the VaultLaunch launcher can report downloads)
-- ---------------------------------------------------------------------------
-- Run this once in the Supabase SQL editor.
--
-- Why: the site used to bump `programs.dl` by POSTing the ENTIRE programs array
-- back through /api/programs. That is racy (two people downloading at the same
-- second lose a count, because each sends a stale copy of the whole table) and
-- it means anything that wants to count a download needs write access to every
-- program row — which the launcher rightly does not have.
--
-- This function increments exactly one counter, atomically, and nothing else.

CREATE OR REPLACE FUNCTION public.increment_program_downloads(pid TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.programs
     SET dl = COALESCE(dl, 0) + 1
   WHERE id = pid
  RETURNING dl INTO new_count;

  RETURN new_count;   -- NULL when no such program
END;
$$;

-- The API route calls this with the service role, so no extra grants are
-- required. If you ever want to call it straight from the browser with the
-- anon key, uncomment the line below.
-- GRANT EXECUTE ON FUNCTION public.increment_program_downloads(TEXT) TO anon;
