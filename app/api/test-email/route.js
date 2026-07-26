import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";

// Require the caller to be authenticated and an admin (profiles.is_admin).
async function authUser(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return { error: "Missing bearer token", status: 401 };
  const svc = getServiceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) return { error: "Invalid or expired token", status: 401 };
  const { data: p, error: pe } = await svc.from('profiles').select('is_admin').eq('id', data.user.id).single();
  if (pe) return { error: 'Failed to read profile', status: 500 };
  if (!p || !p.is_admin) return { error: 'Unauthorized', status: 401 };
  return { user: data.user, svc };
}

export async function POST(req) {
  const a = await authUser(req);
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });

  try {
    const body = await req.json().catch(() => ({}));
    const email = body.email?.trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }

    const hasResend = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@resend.dev";
    if (!hasResend) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
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
