import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import crypto from "crypto";
import { getServiceClient } from "@/lib/vault_client";
import { rateLimit, clientKey, tooMany } from "@/lib/api_auth";

// POST /api/auth/login/start   body { identifier, password }
//
//   -> { session }                          signed in, nothing further needed
//   -> { mfaRequired: "email", ticket }      a code was emailed; call /verify
//   -> { mfaRequired: "totp", session }      app factor: finish with supabase.auth.mfa
//
// Why the password check happens here rather than in the browser: for accounts
// using the email code, the session must NOT reach the client until the code is
// confirmed. So it is created here, parked in login_codes, and only handed over
// by the verify route.
//
// This is not airtight and shouldn't be sold as such — Supabase's own password
// endpoint remains reachable from anywhere, so someone with the password can
// still get a session directly without a code. The authenticator-app factor is
// the one the auth server itself enforces.

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const resendKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;

const CODE_TTL_MIN = 10;

function sha256(v) {
  return crypto.createHash("sha256").update(String(v)).digest("hex");
}

export async function POST(req) {
  if (!rateLimit("login:" + clientKey(req), 10, 60_000)) return tooMany();

  try {
    if (!URL_ || !ANON) {
      return NextResponse.json({ error: "Server not configured" }, { status: 503 });
    }
    const { identifier, password } = await req.json().catch(() => ({}));
    if (!identifier || !password) {
      return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
    }

    const svc = getServiceClient();

    // an email or a username, same as the site has always accepted
    let email = String(identifier).trim();
    if (!email.includes("@")) {
      const { data: prof } = await svc
        .from("profiles").select("id").ilike("username", email).single();
      if (!prof) {
        return NextResponse.json({ error: "Invalid login credentials" }, { status: 400 });
      }
      const { data: userRes } = await svc.auth.admin.getUserById(prof.id);
      email = userRes?.user?.email || "";
      if (!email) {
        return NextResponse.json({ error: "Invalid login credentials" }, { status: 400 });
      }
    }

    // verify the password without keeping a session on the server
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: signIn, error: signInErr } =
      await anon.auth.signInWithPassword({ email, password });
    if (signInErr || !signIn?.session) {
      // pass Supabase's own wording through so "email not confirmed" still shows
      return NextResponse.json(
        { error: signInErr?.message || "Invalid login credentials" }, { status: 400 });
    }

    const userId = signIn.user.id;
    const { data: profile } = await svc
      .from("profiles").select("email_2fa_enabled").eq("id", userId).single();

    // an enrolled authenticator app wins: the auth server handles that challenge
    const { data: factors } = await svc.auth.admin.mfa.listFactors({ userId });
    const hasTotp = (factors?.factors || []).some(
      (f) => f.factor_type === "totp" && f.status === "verified");
    if (hasTotp) {
      return NextResponse.json({ mfaRequired: "totp", session: signIn.session });
    }

    if (!profile?.email_2fa_enabled) {
      return NextResponse.json({ session: signIn.session });
    }

    // ---- email code path: park the session, send the code -----------------
    if (!resendKey || !fromEmail) {
      return NextResponse.json({
        error: "Email 2FA is on for this account but email sending isn't configured.",
        info: "resend_missing",
      }, { status: 500 });
    }

    await svc.rpc("purge_expired_login_codes").catch(() => {});

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    const { data: row, error: insErr } = await svc
      .from("login_codes")
      .insert({
        user_id: userId,
        code_hash: sha256(code),
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
        expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
      })
      .select("ticket")
      .single();
    if (insErr) throw insErr;

    const resend = new Resend(resendKey);
    const sent = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Your SoftwareVault sign-in code",
      html: `<p>Your sign-in code is <strong style="font-size:20px;letter-spacing:3px">${code}</strong></p>`
          + `<p>It expires in ${CODE_TTL_MIN} minutes. If this wasn't you, change your password.</p>`,
    });
    if (sent.error) {
      await svc.from("login_codes").delete().eq("ticket", row.ticket);
      console.error("2FA mail error:", sent.error);
      return NextResponse.json({ error: "Could not send the code" }, { status: 500 });
    }

    return NextResponse.json({ mfaRequired: "email", ticket: row.ticket });
  } catch (e) {
    console.error("login start error:", e);
    return NextResponse.json({ error: "Sign-in failed" }, { status: 500 });
  }
}
