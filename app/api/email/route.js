import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const { email, otp } = await req.json().catch(() => ({}));

    if (!email || !otp) {
      return NextResponse.json({ error: "Missing email or otp" }, { status: 400 });
    }

    const result = await resend.emails.send({
      from: "noreply@softwarevault.local",
      to: email,
      subject: "Your 2FA Code",
      html: `<p>Your 2FA code is: <strong>${otp}</strong></p><p>This code expires in 15 minutes.</p>`,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json({ error: err.message || "Failed to send email" }, { status: 500 });
  }
}
