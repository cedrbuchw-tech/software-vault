import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api_auth";

// POST /api/auth/email2fa   body { enabled: boolean }   -> { enabled }
//
// Turns the email-code factor on or off for the CALLER. The column itself is
// not writable by users (see MIGRATION_EMAIL_2FA.sql), so this route with the
// service role is the only way to change it.

export async function POST(req) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const { enabled } = await req.json().catch(() => ({}));
    const value = !!enabled;

    if (value && !process.env.RESEND_FROM_EMAIL) {
      // refuse rather than locking someone out of an account whose codes could
      // never be delivered
      return NextResponse.json({
        error: "Email sending isn't configured, so email codes can't be turned on.",
        info: "resend_from_missing",
      }, { status: 500 });
    }

    const { error } = await auth.svc
      .from("profiles").update({ email_2fa_enabled: value }).eq("id", auth.user.id);
    if (error) throw error;

    return NextResponse.json({ enabled: value });
  } catch (e) {
    console.error("email2fa toggle error:", e);
    return NextResponse.json({ error: "Could not update the setting" }, { status: 500 });
  }
}
