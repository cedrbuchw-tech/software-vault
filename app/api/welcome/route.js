import { NextResponse } from "next/server";
import { Resend } from "resend";

const resendKey = process.env.RESEND_API_KEY;
const resend = resendKey ? new Resend(resendKey) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@resend.dev";

export async function POST(req) {
  try {
    if (!resend) return NextResponse.json({ ok: false, error: "Email service not configured", info: "resend_missing" }, { status: 500 });
    const { email } = await req.json().catch(() => ({}));
    if (!email || typeof email !== 'string') return NextResponse.json({ error: 'Missing email' }, { status: 400 });

    try {
      const result = await resend.emails.send({
        from: fromEmail,
        to: email,
        subject: 'Welcome to SoftwareVault',
        html: `<p>Welcome — thanks for creating an account at SoftwareVault.</p><p>If you don't receive the confirmation email from the authentication provider, check your spam folder or contact the site admin.</p>`,
      });

      if (result?.error) {
        console.error('Resend error:', result.error);
        return NextResponse.json({ error: result.error.message || 'Failed to send' }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    } catch (e) {
      // Resend often returns 403 validation_error in dev when domain not verified.
      console.error('Resend send failed:', e);
      if (e?.statusCode === 403 || (e?.name === 'validation_error')) {
        return NextResponse.json({ ok: false, info: 'resend_validation', message: e.message });
      }
      return NextResponse.json({ error: e.message || 'Failed to send' }, { status: 500 });
    }
  } catch (err) {
    console.error('Welcome email error:', err);
    return NextResponse.json({ error: err.message || 'Failed to send welcome email' }, { status: 500 });
  }
}
