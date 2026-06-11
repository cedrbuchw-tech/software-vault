import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";
import { signToken, verifyToken, getAdminTokenFromReq } from "@/lib/admin_utils";
import { getLocalSetting, setLocalSetting, setLocalSettings, deleteLocalSetting } from "@/lib/settings_fallback";
import crypto from "crypto";

const SUPABASE_ENABLED = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL_KEY = "admin_email";
const ADMIN_OTP_KEY = "admin_otp";
const ADMIN_OTP_EXP_KEY = "admin_otp_exp";
const TWO_FACTOR_ENABLED_KEY = "two_factor_enabled";
const OTP_WINDOW_MS = 15 * 60 * 1000;

// This route provides simple admin setup/login/change endpoints.
// It stores the admin password hash in the `settings` table under key `admin_pw`.
// If Supabase is not configured or the table is missing, it falls back to a local file store.

function isMissingTableError(err) {
  return !!err?.message?.includes("Could not find the table") || !!err?.message?.includes("does not exist") || !!err?.message?.includes("table \"public.settings\"");
}

function maskEmail(email) {
  if (!email || typeof email !== "string") return "hidden email";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 1)}${local.length > 2 ? "***" : ""}${local.slice(-1)}@${domain}`;
}

async function fetchAdminRecord() {
  if (!SUPABASE_ENABLED) return { fallback: true, data: null };
  try {
    const svc = getServiceClient();
    const result = await svc.from("settings").select("key,value").in("key", ["admin_pw", ADMIN_EMAIL_KEY, ADMIN_OTP_KEY, ADMIN_OTP_EXP_KEY, TWO_FACTOR_ENABLED_KEY]);
    if (result.error) {
      if (isMissingTableError(result.error)) return { fallback: true, data: null };
      throw result.error;
    }
    const data = {};
    for (const row of result.data ?? []) data[row.key] = row.value;
    return { fallback: false, data };
  } catch (err) {
    if (isMissingTableError(err)) return { fallback: true, data: null };
    throw err;
  }
}

async function writeAdminSetting(key, value) {
  if (SUPABASE_ENABLED) {
    try {
      const svc = getServiceClient();
      const { error } = await svc.from("settings").upsert({ key, value });
      if (!error) return;
      if (!isMissingTableError(error)) throw error;
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }
  }
  setLocalSetting(key, value);
}

async function writeAdminSettingsBatch(updates) {
  if (SUPABASE_ENABLED) {
    try {
      const svc = getServiceClient();
      const rows = Object.entries(updates).map(([key, value]) => ({ key, value }));
      const { error } = await svc.from("settings").upsert(rows);
      if (!error) return;
      if (!isMissingTableError(error)) throw error;
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }
  }
  setLocalSettings(updates);
}

async function removeAdminSetting(key) {
  if (SUPABASE_ENABLED) {
    try {
      const svc = getServiceClient();
      const { error } = await svc.from("settings").delete().eq("key", key);
      if (!error) return;
      if (!isMissingTableError(error)) throw error;
    } catch (err) {
      if (!isMissingTableError(err)) throw err;
    }
  }
  deleteLocalSetting(key);
}

function hashPw(pw, salt = null) {
  const s = salt || crypto.randomBytes(16).toString("hex");
  const h = crypto.scryptSync(pw, s, 64).toString("hex");
  return { salt: s, hash: h };
}

export async function POST(req) {
  const body = await req.json().catch(()=>null);
  if(!body || !body.action) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const stored = await fetchAdminRecord();
  const localAdmin = getLocalSetting("admin_pw");
  const adminExists = (!stored.fallback && !!stored.data?.admin_pw) || (stored.fallback && !!localAdmin);

  if (body.action === "setup") {
    if (adminExists) return NextResponse.json({ error: "Admin already exists" }, { status: 400 });
    if (!body.pw || body.pw.length < 6) return NextResponse.json({ error: "Password too short" }, { status: 400 });
    if (!body.email || typeof body.email !== "string" || !body.email.includes("@")) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    const rec = hashPw(body.pw);
    const email = body.email.trim().toLowerCase();
    if (stored.fallback) {
      setLocalSetting("admin_pw", JSON.stringify(rec));
      setLocalSetting(ADMIN_EMAIL_KEY, email);
      return NextResponse.json({ ok: true });
    }
    try {
      await writeAdminSetting("admin_pw", JSON.stringify(rec));
      await writeAdminSetting(ADMIN_EMAIL_KEY, email);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json({ error: error.message || "Setup failed" }, { status: 500 });
    }
  }

  if (body.action === "login") {
    if (!body.pw) return NextResponse.json({ error: "Missing password" }, { status: 400 });
    let data = null;
    let email = null;
    if (stored.fallback) {
      if (!localAdmin) return NextResponse.json({ error: "No admin configured" }, { status: 400 });
      data = { value: localAdmin };
      email = getLocalSetting(ADMIN_EMAIL_KEY);
    } else {
      if (!stored.data || !stored.data.admin_pw) return NextResponse.json({ error: "No admin configured" }, { status: 400 });
      data = { value: stored.data.admin_pw };
      email = stored.data?.admin_email;
    }
    let rec;
    try { rec = JSON.parse(data.value); } catch { return NextResponse.json({ error: "Corrupt admin record" }, { status: 500 }); }
    const h = crypto.scryptSync(body.pw, rec.salt, 64).toString("hex");
    if (h !== rec.hash) return NextResponse.json({ error: "Wrong password" }, { status: 401 });

    // Check if 2FA is enabled
    const twoFactorEnabled = stored.fallback ? getLocalSetting(TWO_FACTOR_ENABLED_KEY) === "true" : stored.data?.two_factor_enabled === "true";

    if (!twoFactorEnabled) {
      const token = signToken({ ts: Date.now() });
      const res = NextResponse.json({ ok: true });
      res.headers.append("Set-Cookie", `admin_token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60*60*24}`);
      return res;
    }

    if (!body.otp) {
      const otp = email ? String(Math.floor(100000 + Math.random() * 900000)) : "000000";
      const expires = Date.now() + OTP_WINDOW_MS;
      console.log("2FA: Generating OTP", { otp, expires, email });
      await writeAdminSettingsBatch({ [ADMIN_OTP_KEY]: otp, [ADMIN_OTP_EXP_KEY]: String(expires) });
      const debugOtp = process.env.ADMIN_2FA_DEV_CODE === "true";
      const hasResend = email && process.env.RESEND_API_KEY;
      let emailSent = false;
      if (hasResend) {
        try {
          const baseUrl = req.headers.get('x-forwarded-proto') && req.headers.get('x-forwarded-host')
            ? `${req.headers.get('x-forwarded-proto')}://${req.headers.get('x-forwarded-host')}`
            : `${req.headers.get('origin') || 'http://localhost:3000'}`;
          await fetch(`${baseUrl}/api/email`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, otp }),
          });
          emailSent = true;
        } catch (err) {
          console.warn("2FA email send failed", err?.message || err);
        }
      }
      if (debugOtp) console.warn("Admin 2FA code:", otp);
      return NextResponse.json({
        requires2fa: true,
        message: emailSent ? `2FA code sent to ${maskEmail(email)}.` : email ? `Failed to send email; use code ${otp}.` : `Temporary code: ${otp}`,
      });
    }
    const otpValue = body.otp.trim();
    if (!otpValue) return NextResponse.json({ error: "Missing 2FA code" }, { status: 400 });
    // Always do a fresh read when verifying OTP to avoid stale data
    const freshStored = await fetchAdminRecord();
    const storedOtp = freshStored.fallback ? getLocalSetting(ADMIN_OTP_KEY) : freshStored.data?.admin_otp;
    const storedExp = freshStored.fallback ? getLocalSetting(ADMIN_OTP_EXP_KEY) : freshStored.data?.admin_otp_exp;
    const now = Date.now();
    const expTime = storedExp ? Number(storedExp) : 0;
    console.log("2FA: Verifying", { storedOtp, storedExp, expTime, now, fallback: freshStored.fallback, otpMatch: otpValue === storedOtp, expired: now > expTime });
    if (!storedOtp || !storedExp || now > expTime) {
      console.error("2FA Error - OTP:", storedOtp, "Exp:", storedExp, "Now:", now, "ExpTime:", expTime, "Expired:", now > expTime);
      return NextResponse.json({ error: "The 2FA code expired. Request a new one." }, { status: 400 });
    }
    if (otpValue !== storedOtp) return NextResponse.json({ error: "Invalid 2FA code" }, { status: 401 });
    await removeAdminSetting(ADMIN_OTP_KEY);
    await removeAdminSetting(ADMIN_OTP_EXP_KEY);
    const token = signToken({ ts: Date.now() });
    const res = NextResponse.json({ ok: true });
    res.headers.append("Set-Cookie", `admin_token=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60*60*24}`);
    return res;
  }

  if (body.action === "set_email") {
    const token = getAdminTokenFromReq(req);
    if (!verifyToken(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!body.email || typeof body.email !== "string" || !body.email.includes("@")) return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    const email = body.email.trim().toLowerCase();
    try {
      await writeAdminSetting(ADMIN_EMAIL_KEY, email);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json({ error: error.message || "Could not set email" }, { status: 500 });
    }
  }

  if (body.action === "change") {
    const token = getAdminTokenFromReq(req);
    if (!verifyToken(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!body.newPw || body.newPw.length < 6) return NextResponse.json({ error: "New password too short" }, { status: 400 });
    const rec = hashPw(body.newPw);
    if (stored.fallback) {
      setLocalSetting("admin_pw", JSON.stringify(rec));
      return NextResponse.json({ ok: true });
    }
    try {
      await writeAdminSetting("admin_pw", JSON.stringify(rec));
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json({ error: error.message || "Could not change password" }, { status: 500 });
    }
  }

  if (body.action === "set_2fa") {
    const token = getAdminTokenFromReq(req);
    if (!verifyToken(token)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const enabled = body.enabled === true ? "true" : "false";
    try {
      await writeAdminSetting(TWO_FACTOR_ENABLED_KEY, enabled);
      return NextResponse.json({ ok: true });
    } catch (error) {
      return NextResponse.json({ error: error.message || "Could not update 2FA setting" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function GET(req) {
  const stored = await fetchAdminRecord();
  const hasPassword = stored.fallback ? !!getLocalSetting("admin_pw") : !!(stored.data && stored.data.admin_pw);
  const email = stored.fallback ? getLocalSetting(ADMIN_EMAIL_KEY) : stored.data?.admin_email;
  const token = getAdminTokenFromReq(req);
  const authed = verifyToken(token);
  return NextResponse.json({ exists: hasPassword, authed, adminEmail: email ? maskEmail(email) : null });
}
