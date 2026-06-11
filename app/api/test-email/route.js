import { NextResponse } from "next/server";
import { getAdminTokenFromReq, verifyToken } from "@/lib/admin_utils";

export async function POST(req) {
  const token = getAdminTokenFromReq(req);
  if (!verifyToken(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const email = body.email?.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const hasResend = process.env.RESEND_API_KEY;
    if (!hasResend) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    const baseUrl = req.headers.get('x-forwarded-proto') && req.headers.get('x-forwarded-host')
      ? `${req.headers.get('x-forwarded-proto')}://${req.headers.get('x-forwarded-host')}`
      : `${req.headers.get('origin') || 'http://localhost:3000'}`;

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "noreply@resend.dev",
        to: email,
        subject: "Test Email - Software Vault",
        html: `<h1>Test Email</h1><p>This is a test email from your Software Vault admin panel.</p><p>If you received this, your email is configured correctly!</p>`,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", result);
      return NextResponse.json({ error: result.message || "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, messageId: result.id });
  } catch (err) {
    console.error("Test email error:", err);
    return NextResponse.json({ error: err.message || "Failed to send test email" }, { status: 500 });
  }
}
