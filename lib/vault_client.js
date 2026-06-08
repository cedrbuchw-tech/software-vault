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

// Public client — safe in browser, read-only
export const supabase = createClient(URL, ANON);

// Service client — write access, only used in API routes (server-side)
export function getServiceClient() {
  const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SVC) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
  return createClient(URL, SVC, { auth: { persistSession: false } });
}