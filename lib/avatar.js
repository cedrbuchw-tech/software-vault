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
export async function uploadAvatar(file, userId) {
  if (!file) throw new Error("No file chosen");
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error("Use a JPEG, PNG, WebP or GIF image");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("That image is larger than 5 MB");
  }

  const blob = await squareThumbnail(file);
  // a fresh name each time, so caches and CDNs can't serve the old picture
  const path = `${userId}/${Date.now()}.jpg`;

  const { error: upErr } = await supabase.storage
    .from("avatars")
    .upload(path, blob, { contentType: "image/jpeg", upsert: true });
  if (upErr) throw upErr;

  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  const url = data?.publicUrl;
  if (!url) throw new Error("Upload succeeded but no URL came back");

  const { error: saveErr } = await supabase
    .from("profiles").update({ avatar_url: url }).eq("id", userId);
  if (saveErr) throw saveErr;

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
