import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api_auth";

// POST /api/auth/email2fa   body { enabled: boolean }   -> { enabled }
//
// Toggles the email-code factor for the caller. Users cannot write the column
// directly (MIGRATION_EMAIL_2FA.sql), so this service-role route is the only way.

export async function POST(req) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const { enabled } = await req.json().catch(() => ({}));
    const value = !!enabled;

    if (value && !process.env.RESEND_FROM_EMAIL) {
      // refuse, or the account locks itself out behind codes it cannot receive
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
