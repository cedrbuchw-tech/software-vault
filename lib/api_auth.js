import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";

// Shared auth guards for API routes.
//
// Before this existed every route rolled its own check — or, in several cases,
// none at all, and simply trusted a `userId` sent in the request body. Anyone
// could then act as anyone else just by typing a different id. These helpers
// take the identity from the verified bearer token and nothing else.
//
// Usage:
//   const auth = await requireUser(req);
//   if (auth.response) return auth.response;      // 401 already prepared
//   auth.user.id  /  auth.svc

function fail(message, status) {
  return { response: NextResponse.json({ error: message }, { status }) };
}

/** Verify the caller's Supabase access token. Identity comes from the token. */
export async function requireUser(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return fail("Missing bearer token", 401);

  let svc;
  try {
    svc = getServiceClient();
  } catch (e) {
    return fail("Server not configured", 503);
  }

  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) return fail("Invalid or expired token", 401);
  return { user: data.user, svc };
}

/**
 * Addresses that are always admins, from ADMIN_EMAILS (comma separated).
 *
 * A safety net: admin rights live in profiles.is_admin, which is handed out
 * from the admin panel — and can therefore be taken away by mistake, leaving
 * nobody able to get back in. Anyone listed here is an admin regardless, and
 * gets the flag written back onto their profile the first time they show up.
 */
const OWNER_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export function isOwnerEmail(email) {
  return !!email && OWNER_EMAILS.includes(String(email).toLowerCase());
}

/** True when ADMIN_EMAILS names at least one permanent admin. */
export function hasOwnerEmails() {
  return OWNER_EMAILS.length > 0;
}

/**
 * Is this user an admin? Reads profiles.is_admin, with the ADMIN_EMAILS list as
 * an override. Never throws — an unreadable profile means "not an admin".
 */
export async function checkAdmin(svc, user) {
  if (isOwnerEmail(user?.email)) {
    // keep the table in step, so every other is_admin check agrees
    try { await svc.from("profiles").update({ is_admin: true }).eq("id", user.id); }
    catch { /* best effort */ }
    return true;
  }
  try {
    const { data: profile } = await svc
      .from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
    return !!profile?.is_admin;
  } catch {
    return false;
  }
}

/** Verify the caller is signed in AND flagged as an admin on their profile. */
export async function requireAdmin(req) {
  const auth = await requireUser(req);
  if (auth.response) return auth;

  const ok = await checkAdmin(auth.svc, auth.user);
  if (!ok) return fail("Unauthorized", 403);
  return auth;
}

/**
 * Very small in-memory throttle, keyed by whatever you pass (ip, email, …).
 *
 * Serverless instances are short-lived and not shared, so this is a speed bump
 * rather than a guarantee — enough to stop a naive script hammering the mail
 * endpoints. Put a real limiter in front of the site if abuse continues.
 */
const hits = new Map();

export function rateLimit(key, max = 5, windowMs = 60_000) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.reset) {
    hits.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count += 1;
  return true;
}

export function clientKey(req) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "unknown";
}

export function tooMany() {
  return NextResponse.json(
    { error: "Too many requests — please wait a moment." }, { status: 429 });
}
