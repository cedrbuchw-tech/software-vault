import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getServiceClient } from "@/lib/vault_client";

const resendKey = process.env.RESEND_API_KEY;
const resend = resendKey ? new Resend(resendKey) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@resend.dev";

export async function POST(req) {
  try {
    if (!resend) {
      return NextResponse.json({ ok: false, error: "Email service not configured", info: "resend_missing" }, { status: 500 });
    }

    // Without a verified sender we would fall back to noreply@resend.dev — a
    // domain this project does not own, which Resend refuses to send from. That
    // failure is invisible to the user (the mail simply never arrives), so say
    // plainly what is missing instead. See RESEND_NAMECHEAP_SETUP.md.
    if (!process.env.RESEND_FROM_EMAIL) {
      return NextResponse.json({
        ok: false,
        info: "resend_from_missing",
        error: "RESEND_FROM_EMAIL is not set, so no confirmation mail can be sent.",
      }, { status: 500 });
    }

    const { email, redirectTo } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string") {
      return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "signup",
      email,
      options: { redirectTo: redirectTo || undefined },
    });

    if (error || !data?.properties?.action_link) {
      console.error("Supabase generateLink error:", error, data);
      // If the email already exists in Supabase, return a clear info code so the UI can
      // offer the user to sign in or reset their password instead of showing a server error.
      const isEmailExists = error?.status === 422 || error?.code === 'email_exists' || (error?.message || '').toLowerCase().includes('already been registered') || (error?.message || '').toLowerCase().includes('email_exists');
      if (isEmailExists) {
          // Try to generate a recovery link and send a password reset email instead
          try {
            const { data: recoveryData, error: recoveryError } = await supabase.auth.admin.generateLink({
              type: 'recovery',
              email,
              options: { redirectTo: redirectTo || undefined },
            });
            if (recoveryError || !recoveryData?.properties?.action_link) {
              console.error('Supabase generateLink (recovery) error:', recoveryError, recoveryData);
              return NextResponse.json({ ok: false, info: 'email_exists', error: recoveryError?.message || 'Failed to create recovery link' }, { status: 200 });
            }

            const recoveryLink = recoveryData.properties.action_link;
            const sendResult = await resend.emails.send({
              from: fromEmail,
              to: email,
              subject: 'Reset your SoftwareVault password',
              html: `<p>Click the link below to reset your password:</p><p><a href="${recoveryLink}">${recoveryLink}</a></p><p>If you did not request this, ignore this email.</p>`,
            });

            if (sendResult?.error) {
              console.error('Resend error sending recovery email:', sendResult.error);
              return NextResponse.json({ ok: false, info: 'email_exists', error: sendResult.error.message || 'Failed to send recovery email' }, { status: 200 });
            }

            return NextResponse.json({ ok: true, info: 'recovery_sent', sentTo: email }, { status: 200 });
          } catch (e) {
            console.error('Recovery send failed:', e);
            return NextResponse.json({ ok: false, info: 'email_exists', error: e?.message || 'Failed to send recovery email' }, { status: 200 });
          }
        }
      return NextResponse.json({ ok: false, error: error?.message || "Failed to generate confirmation link" }, { status: 500 });
    }

    const actionLink = data.properties.action_link;
    const result = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Confirm your SoftwareVault account",
      html: `<p>Hi there,</p><p>Click the link below to confirm your account:</p><p><a href="${actionLink}">${actionLink}</a></p><p>If you did not request this, ignore this email.</p>`,
    });

    if (result?.error) {
      console.error("Resend error:", result.error);
      return NextResponse.json({ ok: false, error: result.error.message || "Failed to send confirmation email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, sentTo: email });
  } catch (err) {
    console.error("Resend confirmation error:", err);
    const info = err?.statusCode === 403 || err?.name === "validation_error" ? "resend_validation" : undefined;
    return NextResponse.json({ ok: false, error: err.message || "Failed to send confirmation email", info }, { status: 500 });
  }
}
