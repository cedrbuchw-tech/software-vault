import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Base32 Decode
function base32Decode(input) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  const re = /./g;
  let match;
  while ((match = re.exec(input))) {
    const idx = chars.indexOf(match[0]);
    if (idx === -1) continue;
    bits += ("00000" + idx.toString(2)).slice(-5);
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

// TOTP Verification
function verifyTOTP(secret, token, window = 1) {
  const now = Math.floor(Date.now() / 1000);
  const timeStep = 30;
  const digits = 6;

  for (let i = -window; i <= window; i++) {
    let counter = Math.floor((now + i * timeStep) / timeStep);
    const hmac = crypto.createHmac("sha1", base32Decode(secret));
    const buf = Buffer.alloc(8);
    for (let j = 7; j >= 0; j--) {
      buf[j] = counter & 0xff;
      counter >>= 8;
    }
    hmac.update(buf);
    const digest = hmac.digest();
    const offset = digest[digest.length - 1] & 0xf;
    const code =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);
    const totp = (code % Math.pow(10, digits)).toString();
    if (totp === token.padStart(digits, "0")) return true;
  }
  return false;
}

export async function POST(req) {
  try {
    const { userId, code, secret } = await req.json();
    if (!userId || !code || !secret) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify TOTP code
    if (!verifyTOTP(secret, code)) {
      return Response.json({ error: "Invalid code" }, { status: 400 });
    }

    // Move secret from temp to active, and enable 2FA
    await supabase
      .from("profiles")
      .update({
        two_fa_enabled: true,
        two_fa_secret: secret,
        two_fa_secret_temp: null,
      })
      .eq("id", userId);

    return Response.json({ success: true });
  } catch (e) {
    console.error("2FA Verify Error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
