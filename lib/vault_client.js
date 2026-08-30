// Two Supabase clients: PUBLIC uses the anon key and is safe to expose,
// SERVICE uses SUPABASE_SERVICE_ROLE_KEY and must never be NEXT_PUBLIC_.

import { createClient } from "@supabase/supabase-js";

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Public client, safe in the browser. detectSessionInUrl is off so supabase-js
// cannot swallow the #access_token recovery fragment and rewrite the URL
// before /reset-password reads it.
export const supabase = createClient(URL, ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Service client: write access, server-side API routes only.
export function getServiceClient() {
  const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SVC) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(URL, SVC, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

/**
 * A throwaway anon client for verifying one password on the server.
 * Each call needs its own storageKey: supabase-js serialises auth calls per
 * storage key behind a process-wide lock, so a shared key makes concurrent
 * sign-ins queue behind each other.
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
