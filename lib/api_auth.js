import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";

// Shared auth guards for API routes. Identity comes from the verified bearer
// token, never from a userId in the request body.

function fail(message, status) {
  return { response: NextResponse.json({ error: message }, { status }) };
}

/** Verify the caller's Supabase access token. Returns { response } on failure. */
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
 * Always-admin addresses from ADMIN_EMAILS (comma separated). Escape hatch for
 * when profiles.is_admin gets revoked from everyone; the flag is written back
 * to the profile on first sight.
 */
const OWNER_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);

export function isOwnerEmail(email) {
  return !!email && OWNER_EMAILS.includes(String(email).toLowerCase());
}

export function hasOwnerEmails() {
  return OWNER_EMAILS.length > 0;
}

/**
 * Admin check: profiles.is_admin, overridden by ADMIN_EMAILS. Never throws; an
 * unreadable profile counts as not an admin.
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

export async function requireAdmin(req) {
  const auth = await requireUser(req);
  if (auth.response) return auth;

  const ok = await checkAdmin(auth.svc, auth.user);
  if (!ok) return fail("Unauthorized", 403);
  return auth;
}

/**
 * In-memory throttle keyed by ip, email or similar. Serverless instances are
 * short-lived and unshared, so this is a speed bump, not a guarantee.
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
