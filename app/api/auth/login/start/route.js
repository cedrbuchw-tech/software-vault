import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getServiceClient, getEphemeralAnonClient } from "@/lib/vault_client";
import { rateLimit, clientKey, tooMany } from "@/lib/api_auth";
import { generateLoginCode, hashLoginCode, CODE_LENGTH } from "@/lib/login_code";

// POST /api/auth/login/start   body { identifier, password }
//
//   -> { session }                          signed in, nothing further needed
//   -> { mfaRequired: "email", ticket }      a code was emailed; call /verify
//   -> { mfaRequired: "totp", session }      app factor: finish with supabase.auth.mfa
//
// The password check runs server-side so that, for email-code accounts, the
// session is parked in login_codes and only handed over by /verify.
// Not airtight: Supabase's own password endpoint stays reachable, so a password
// alone still yields a session. Only the TOTP factor is enforced by the auth server.

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const resendKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL;

const CODE_TTL_MIN = 10;

/** One place to fail from; the cause and the stage go to the caller and the log. */
function failed(stage, err, status = 500) {
  const detail = err?.message || String(err || "unknown error");
  console.error(`[login/start] failed at ${stage}:`, err);
  return NextResponse.json(
    { error: `Sign-in failed (${stage}): ${detail}`, stage, detail },
    { status },
  );
}

export async function POST(req) {
  if (!rateLimit("login:" + clientKey(req), 10, 60_000)) return tooMany();

  if (!URL_ || !ANON) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const { identifier, password } = await req.json().catch(() => ({}));
  if (!identifier || !password) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  let svc;
  try {
    svc = getServiceClient();
  } catch (e) {
    return failed("server-config", e, 503);
  }

  // identifier may be an email or a username
  let email = String(identifier).trim();
  if (!email.includes("@")) {
    try {
      const { data: prof, error: profErr } = await svc
        .from("profiles").select("id").ilike("username", email).maybeSingle();
      if (profErr) return failed("username-lookup", profErr);
      if (!prof) {
        return NextResponse.json({ error: "Invalid login credentials" }, { status: 400 });
      }
      const { data: userRes, error: userErr } = await svc.auth.admin.getUserById(prof.id);
      if (userErr) return failed("username-lookup", userErr);
      email = userRes?.user?.email || "";
      if (!email) {
        return NextResponse.json({ error: "Invalid login credentials" }, { status: 400 });
      }
    } catch (e) {
      return failed("username-lookup", e);
    }
  }

  // Password check with no session kept on the server. Each attempt gets its own
  // throwaway client and storage key, so concurrent sign-ins cannot share state.
  let signIn;
  try {
    const anon = getEphemeralAnonClient();
    const { data, error: signInErr } = await anon.auth.signInWithPassword({ email, password });
    if (signInErr || !data?.session) {
      // pass Supabase's own wording through so "email not confirmed" still shows
      return NextResponse.json(
        { error: signInErr?.message || "Invalid login credentials" }, { status: 400 });
    }
    signIn = data;
  } catch (e) {
    return failed("password-check", e);
  }

  const userId = signIn.user?.id;
  if (!userId) return failed("password-check", new Error("No user on the session"));

  // Which second factor? Neither lookup may fail the sign-in; both default to
  // no factor, so a missing profile row cannot lock the account out.
  let emailTwoFa = false;
  try {
    const { data: profile } = await svc
      .from("profiles").select("email_2fa_enabled").eq("id", userId).maybeSingle();
    emailTwoFa = !!profile?.email_2fa_enabled;
  } catch (e) {
    console.error("[login/start] could not read email_2fa_enabled:", e);
  }

  let hasTotp = false;
  try {
    const { data: factors } = await svc.auth.admin.mfa.listFactors({ userId });
    hasTotp = (factors?.factors || []).some(
      (f) => f.factor_type === "totp" && f.status === "verified");
  } catch (e) {
    console.error("[login/start] could not list MFA factors:", e);
  }

  // an enrolled authenticator app wins: the auth server handles that challenge
  if (hasTotp) {
    return NextResponse.json({ mfaRequired: "totp", session: signIn.session });
  }
  if (!emailTwoFa) {
    return NextResponse.json({ session: signIn.session });
  }

  // Email code path: park the session, send the code.
  if (!resendKey || !fromEmail) {
    return NextResponse.json({
      error: "Email 2FA is on for this account but email sending isn't configured "
           + "(RESEND_API_KEY / RESEND_FROM_EMAIL).",
      info: "resend_missing",
    }, { status: 500 });
  }

  let ticket;
  try {
    // A supabase query builder is a thenable with no `.catch`; errors from these
    // two housekeeping calls are returned, not thrown, so read them instead.
    const { error: purgeErr } = await svc.rpc("purge_expired_login_codes");
    if (purgeErr) console.error("[login/start] purge failed (ignored):", purgeErr);

    // Any code still pending for this account is dead once a new sign-in starts.
    const { error: sweepErr } = await svc.from("login_codes").delete().eq("user_id", userId);
    if (sweepErr) console.error("[login/start] sweep failed (ignored):", sweepErr);

    const code = generateLoginCode();
    const { data: row, error: insErr } = await svc
      .from("login_codes")
      .insert({
        user_id: userId,
        code_hash: hashLoginCode(code),
        access_token: signIn.session.access_token,
        refresh_token: signIn.session.refresh_token,
        expires_at: new Date(Date.now() + CODE_TTL_MIN * 60_000).toISOString(),
      })
      .select("ticket")
      .single();
    if (insErr) return failed("store-code", insErr);
    ticket = row.ticket;

    const resend = new Resend(resendKey);
    const sent = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Your SoftwareVault sign-in code",
      html: `<p>Your sign-in code is <strong style="font-size:22px;letter-spacing:4px">${code}</strong></p>`
          + `<p>All ${CODE_LENGTH} characters, upper or lower case \u2014 either works.</p>`
          + `<p>It expires in ${CODE_TTL_MIN} minutes. If this wasn't you, change your password.</p>`,
    });
    if (sent.error) {
      await svc.from("login_codes").delete().eq("ticket", ticket);
      return failed("send-code", sent.error);
    }
  } catch (e) {
    if (ticket) {
      try { await svc.from("login_codes").delete().eq("ticket", ticket); } catch { /* best effort */ }
    }
    return failed("send-code", e);
  }

  return NextResponse.json({ mfaRequired: "email", ticket });
}
