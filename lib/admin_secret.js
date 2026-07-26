import { getServiceClient } from "@/lib/vault_client";
import { getLocalSetting, setLocalSetting } from "@/lib/settings_fallback";
import crypto from "crypto";

const SUPABASE_ENABLED = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET_KEY = "admin_token_secret";

function isMissingTable(err) {
  return !!err?.message?.includes("Could not find the table") || !!err?.message?.includes("does not exist");
}

// Resolves the secret used to sign/verify admin session tokens.
// Uses ADMIN_SECRET when set; otherwise falls back to a persisted random secret
// so the admin session keeps working even when no env var is configured.
export async function getTokenSecret() {
  if (process.env.ADMIN_SECRET) return process.env.ADMIN_SECRET;
  if (SUPABASE_ENABLED) {
    try {
      const svc = getServiceClient();
      const { data, error } = await svc.from("settings").select("value").eq("key", SECRET_KEY).maybeSingle();
      if (!error) {
        if (data && data.value) return data.value;
        const gen = crypto.randomBytes(32).toString("hex");
        const { error: writeErr } = await svc.from("settings").upsert({ key: SECRET_KEY, value: gen });
        if (!writeErr) return gen;
      }
    } catch (e) {
      // fall through to local-file fallback
    }
  }
  let secret = getLocalSetting(SECRET_KEY);
  if (!secret) {
    secret = crypto.randomBytes(32).toString("hex");
    setLocalSetting(SECRET_KEY, secret);
  }
  return secret;
}
