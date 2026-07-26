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

/** Verify the caller is signed in AND flagged as an admin on their profile. */
export async function requireAdmin(req) {
  const auth = await requireUser(req);
  if (auth.response) return auth;

  const { data: profile, error } = await auth.svc
    .from("profiles").select("is_admin").eq("id", auth.user.id).single();
  if (error) return fail("Could not verify permissions", 500);
  if (!profile?.is_admin) return fail("Unauthorized", 403);
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
