// lib/vault_client.js
// ── Two Supabase clients:
//    PUBLIC  — uses NEXT_PUBLIC_SUPABASE_ANON_KEY   → safe to expose, read-only by policy
//    SERVICE — uses SUPABASE_SERVICE_ROLE_KEY        → server-side only, never in the browser
//
// Add these to your .env.local (Vercel → Settings → Environment Variables):
//
//   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
//   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← NEVER prefix with NEXT_PUBLIC_

import { createClient } from "@supabase/supabase-js";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Public client — safe in browser, read-only.
//
// detectSessionInUrl is deliberately OFF. It used to race the UI: supabase-js
// swallowed the `#access_token=…&type=recovery` fragment and rewrote the address
// bar before anything could notice WHY the visitor had arrived, so a password
// reset link just dropped you on the homepage. /reset-password now reads the
// link itself and hands the tokens over explicitly, which is deterministic.
export const supabase = createClient(URL, ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Service client — write access, only used in API routes (server-side)
export function getServiceClient() {
  const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SVC) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(URL, SVC, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * A throwaway anon client for verifying one password on the server.
 *
 * Every one of these gets its OWN storage key. Without that, each request built
 * a client on the shared default key, and supabase-js serialises auth calls per
 * storage key with a process-wide lock — so concurrent or back-to-back sign-ins
 * inside one server process queued behind each other and could fail or hang once
 * an earlier client was left holding the lock. A unique key per call keeps every
 * sign-in completely independent.
 */
export function getEphemeralAnonClient() {
  if (!URL || !ANON) throw new Error("Supabase URL / anon key not set");
  const unique = `sv-oneshot-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return createClient(URL, ANON, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storageKey: unique,
      // nothing else shares this client, so a lock would only add a failure mode
      lock: async (_name, _acquireTimeout, fn) => fn(),
    },
  });
}
