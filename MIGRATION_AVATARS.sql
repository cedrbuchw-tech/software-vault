-- Profile pictures — run once in the Supabase SQL editor. Safe to re-run.
-- ===========================================================================

-- ── 1. where the picture lives on the profile ──────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

-- Privileges are owned by MIGRATION_SECURITY.sql, which lists every readable and
-- owner-writable column in one place and rebuilds the grants from the columns
-- that actually exist. Granting here as well caused a nasty trap: re-running the
-- security migration afterwards wiped these, and saving a picture started failing
-- with "permission denied for table profiles".
--
-- So: after adding this column, run MIGRATION_SECURITY.sql once more.
GRANT SELECT (avatar_url) ON public.profiles TO anon, authenticated;
GRANT UPDATE (avatar_url) ON public.profiles TO authenticated;


-- ── 2. the storage bucket ──────────────────────────────────────────────────
-- Public read: avatars are shown next to usernames, so the images must be
-- fetchable without a token. Writing is another matter entirely (below).
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;


-- ── 3. who may write there ─────────────────────────────────────────────────
-- Every file must live under a folder named after the owner's user id, e.g.
--   avatars/9e3d02ad-…/avatar.jpg
-- The policies compare that first path segment with auth.uid(), so a signed-in
-- user can only ever touch their own folder — not overwrite someone else's
-- picture, and not fill the bucket under another account's name.

DROP POLICY IF EXISTS "avatars_read_all" ON storage.objects;
CREATE POLICY "avatars_read_all" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_insert_own" ON storage.objects;
CREATE POLICY "avatars_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_update_own" ON storage.objects;
CREATE POLICY "avatars_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars_delete_own" ON storage.objects;
CREATE POLICY "avatars_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ── Check afterwards ───────────────────────────────────────────────────────
--   SELECT id, public FROM storage.buckets WHERE id = 'avatars';
--
--   SELECT policyname, cmd FROM pg_policies
--    WHERE schemaname = 'storage' AND tablename = 'objects'
--      AND policyname LIKE 'avatars%';
--
-- Note: file size and type are limited in the upload code as well. Supabase can
-- enforce that per bucket too — Storage → avatars → Settings → restrict to
-- image/png, image/jpeg, image/webp and a 2 MB limit — which is worth setting,
-- since policies alone don't check what's inside the file.
