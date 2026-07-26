import { NextResponse } from "next/server";
import { Resend } from "resend";
import { requireUser, rateLimit, clientKey, tooMany } from "@/lib/api_auth";

// POST /api/email   body { otp }   -> sends a code to the CALLER's own address
//
// This was an open mail relay: it accepted `{ email, otp }` from anyone and had
// Resend deliver a "Your 2FA Code" message, from this project's verified domain,
// to any address on the internet with attacker-chosen text in the code field —
// ideal for phishing, and a fast way to get the sending domain blacklisted.
//
// It now requires a signed-in caller and always sends to that account's own
// address; the recipient can no longer be chosen by the request.

const resendKey = process.env.RESEND_API_KEY;
const resend = resendKey ? new Resend(resendKey) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL;

export async function POST(req) {
  if (!rateLimit("email:" + clientKey(req), 5, 60_000)) return tooMany();

  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    if (!resend) {
      return NextResponse.json(
        { error: "Email service not configured", info: "resend_missing" }, { status: 500 });
    }
    if (!fromEmail) {
      return NextResponse.json(
        { error: "RESEND_FROM_EMAIL is not set", info: "resend_from_missing" }, { status: 500 });
    }

    const { otp } = await req.json().catch(() => ({}));
    // only a six digit code is ever echoed back into the message body
    const code = String(otp || "").trim();
    if (!/^\d{4,8}$/.test(code)) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    const result = await resend.emails.send({
      from: fromEmail,
      to: auth.user.email,
      subject: "Your SoftwareVault code",
      html: `<p>Your code is: <strong>${code}</strong></p>`
          + `<p>It expires in 15 minutes. If you didn't request it, ignore this email.</p>`,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return NextResponse.json({ error: "Could not send email" }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json({ error: "Could not send email" }, { status: 500 });
  }
}
