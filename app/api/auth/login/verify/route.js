import { NextResponse } from "next/server";
import crypto from "crypto";
import { getServiceClient } from "@/lib/vault_client";
import { rateLimit, clientKey, tooMany } from "@/lib/api_auth";

// POST /api/auth/login/verify   body { ticket, code }   -> { session }
//
// Hands over the session that /start parked, but only for a correct, unexpired,
// unused code. The row is deleted the moment it is used or written off, so a
// code works exactly once.

const MAX_ATTEMPTS = 5;

function sha256(v) {
  return crypto.createHash("sha256").update(String(v)).digest("hex");
}

export async function POST(req) {
  if (!rateLimit("login-verify:" + clientKey(req), 15, 60_000)) return tooMany();

  try {
    const { ticket, code } = await req.json().catch(() => ({}));
    if (!ticket || !code) {
      return NextResponse.json({ error: "Missing code" }, { status: 400 });
    }

    const svc = getServiceClient();
    const { data: row } = await svc
      .from("login_codes")
      .select("ticket, code_hash, access_token, refresh_token, attempts, expires_at")
      .eq("ticket", ticket)
      .single();

    if (!row) {
      return NextResponse.json({ error: "This code is no longer valid — sign in again." }, { status: 400 });
    }
    if (new Date(row.expires_at) < new Date()) {
      await svc.from("login_codes").delete().eq("ticket", ticket);
      return NextResponse.json({ error: "That code expired — sign in again." }, { status: 400 });
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      await svc.from("login_codes").delete().eq("ticket", ticket);
      return NextResponse.json({ error: "Too many attempts — sign in again." }, { status: 429 });
    }

    // constant-time compare so timing can't leak the digits
    const given = Buffer.from(sha256(String(code).trim()));
    const expected = Buffer.from(row.code_hash);
    const ok = given.length === expected.length && crypto.timingSafeEqual(given, expected);

    if (!ok) {
      await svc.from("login_codes")
        .update({ attempts: row.attempts + 1 }).eq("ticket", ticket);
      const left = MAX_ATTEMPTS - (row.attempts + 1);
      return NextResponse.json({
        error: left > 0 ? `Wrong code — ${left} attempt${left === 1 ? "" : "s"} left.`
                        : "Too many attempts — sign in again.",
      }, { status: 400 });
    }

    // single use
    await svc.from("login_codes").delete().eq("ticket", ticket);

    return NextResponse.json({
      session: {
        access_token: row.access_token,
        refresh_token: row.refresh_token,
      },
    });
  } catch (e) {
    console.error("login verify error:", e);
    return NextResponse.json({ error: "Could not verify the code" }, { status: 500 });
  }
}
