"use client";
import { supabase } from "@/lib/vault_client";

// Profile picture upload.
//
// The image is squared off and shrunk in the browser before it goes anywhere:
// phone photos are several megabytes and thousands of pixels wide, and none of
// that survives being drawn at 40px in a header. Uploading the original would
// just cost storage and make every page load slower.

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;   // before processing
export const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const OUTPUT_SIZE = 256;

/**
 * Crop to a square using the viewer's zoom and offset, then scale to 256px.
 *
 * `zoom` is the scale factor the user picked, `offset` is how far they dragged
 * the picture inside the round window, in DISPLAYED pixels. `viewport` is the
 * on-screen size of that window, which is what makes the two coordinate systems
 * line up: everything is converted back into source pixels here.
 */
export function cropToBlob(file, { zoom = 1, offset = { x: 0, y: 0 }, viewport = 220 } = {}) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      // the image is drawn "cover"-style: the short side fills the window
      const base = viewport / Math.min(img.width, img.height);
      const scale = base * zoom;                   // displayed px per source px
      const side = viewport / scale;               // size of the crop in source px

      // centre of the visible window, expressed in source pixels
      const cx = img.width / 2 - offset.x / scale;
      const cy = img.height / 2 - offset.y / scale;

      // keep the crop inside the picture
      const sx = Math.max(0, Math.min(img.width - side, cx - side / 2));
      const sy = Math.max(0, Math.min(img.height - side, cy - side / 2));

      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not process the image"))),
        "image/jpeg", 0.9);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't a readable image"));
    };
    img.src = url;
  });
}

/** Centre-crop to a square and scale to 256px, returned as a JPEG blob. */
export function squareThumbnail(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;

      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not process the image"))),
        "image/jpeg",
        0.9
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't a readable image"));
    };
    img.src = url;
  });
}

/**
 * Upload a new avatar for the signed-in user and return its public URL.
 * The path always starts with the user's id — the storage policies check that,
 * so nobody can write into someone else's folder.
 */
export async function uploadAvatar(file, userId, crop = null) {
  if (!file) throw new Error("No file chosen");
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Use a JPEG, PNG, WebP or GIF image");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That image is larger than 5 MB");
  }

  const blob = crop ? await cropToBlob(file, crop) : await squareThumbnail(file);
  // a fresh name each time, so caches and CDNs can't serve the old picture
  const path = `${userId}/${Date.now()}.jpg`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (upErr) {
    if (/bucket/i.test(upErr.message || "")) {
      throw new Error("The avatars storage bucket is missing — run MIGRATION_AVATARS.sql.");
    }
    throw new Error(upErr.message || "Upload failed.");
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) throw new Error("Upload succeeded but no URL came back");

  // upsert, not update: an UPDATE silently matches nothing when the profile row
  // is missing — which happens to anyone created while the signup trigger was
  // broken. That was the "uploaded but your profile row didn't accept it" case.
  const { data: saved, error: saveErr } = await supabase
    .from("profiles")
    .upsert({ id: userId, avatar_url: url }, { onConflict: "id" })
    .select("avatar_url");
  if (saveErr) {
    // the two ways this realistically fails, named plainly instead of leaking
    // a Postgres error code
    if (/column .*avatar_url|schema cache/i.test(saveErr.message || "")) {
      throw new Error("The database isn't ready for pictures yet — run MIGRATION_AVATARS.sql.");
    }
    throw new Error(saveErr.message || "Could not save the picture to your profile.");
  }
  // an UPDATE that matches nothing reports no error at all, so check it landed
  if (!saved || saved.length === 0) {
    throw new Error("The picture uploaded but your profile row didn't accept it.");
  }

  removeOldAvatars(userId, path);
  return url;
}

/** Remove this user's previous files so the bucket doesn't grow forever. */
async function removeOldAvatars(userId, keepPath) {
  try {
    const { data: files } = await supabase.storage.from("avatars").list(userId);
    const stale = (files || [])
      .map((f) => `${userId}/${f.name}`)
      .filter((p) => p !== keepPath);
    if (stale.length) await supabase.storage.from("avatars").remove(stale);
  } catch {
    /* tidying is optional — never let it fail the upload */
  }
}

export async function clearAvatar(userId) {
  const { error } = await supabase
    .from("profiles").update({ avatar_url: null }).eq("id", userId);
  if (error) throw error;
  try {
    const { data: files } = await supabase.storage.from("avatars").list(userId);
    const all = (files || []).map((f) => `${userId}/${f.name}`);
    if (all.length) await supabase.storage.from("avatars").remove(all);
  } catch {
    /* ignore */
  }
}

/** Initials fallback so an account without a picture still looks deliberate. */
export function initialsFor(name, email) {
  const base = (name || email || "?").trim();
  const parts = base.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length >= 2
    ? parts[0][0] + parts[1][0]
    : base.slice(0, 2);
  return letters.toUpperCase();
}
