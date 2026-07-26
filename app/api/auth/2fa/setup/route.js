import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Simple TOTP Secret Generator (Base32)
function generateSecret() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  for (let i = 0; i < 32; i++) {
    secret += chars[crypto.randomInt(0, chars.length)];
  }
  return secret;
}

// Generate QR Code as Data URI
function generateQRCode(secret, email) {
  // Using a Google Charts API to generate QR code (works server-side)
  const encodedSecret = encodeURIComponent(secret);
  const encodedEmail = encodeURIComponent(email);
  const qrText = `otpauth://totp/SoftwareVault:${encodedEmail}?secret=${encodedSecret}&issuer=SoftwareVault`;
  const encodedQR = encodeURIComponent(qrText);
  // Using qr-image-compatible service
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodedQR}`;
}

export async function POST(req) {
  try {
    const { userId } = await req.json();
    if (!userId) return Response.json({ error: "Missing userId" }, { status: 400 });

    // Get user email from auth
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.admin.getUserById(userId);
    if (userError || !user) return Response.json({ error: "User not found" }, { status: 404 });

    const secret = generateSecret();
    const qrCode = generateQRCode(secret, user.email);

    // Store temporary secret in profiles table (not yet verified)
    await supabase
      .from("profiles")
      .update({ two_fa_secret_temp: secret })
      .eq("id", userId);

    return Response.json({ secret, qrCode });
  } catch (e) {
    console.error("2FA Setup Error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
