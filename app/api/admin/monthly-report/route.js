import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getMonthlyStats, generateMonthlyReportEmail } from "@/lib/monthly_stats";
import { getServiceClient } from "@/lib/vault_client";
import { requireAdmin } from "@/lib/api_auth";

// Monthly report.
//
//   GET  ?preview=1   (admin)          → the numbers + the rendered mail, sends nothing
//   GET               (cron or admin)  → builds and SENDS the report
//   POST              (cron or admin)  → same, used by the admin panel button
//
// Why this needed rewriting: vercel.json schedules a GET here on the 1st of every
// month, but GET only ever produced a preview — only POST sent anything. And both
// handlers demanded a Supabase access token belonging to an admin, which a
// scheduled request can never have. So the cron fired, was told 401, and no
// report ever arrived.

const resendKey = process.env.RESEND_API_KEY;
const resend = resendKey ? new Resend(resendKey) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL;
const FALLBACK_RECIPIENT = "CedrBuchw@gmail.com";

/**
 * Is this the scheduler rather than a person?
 *
 * Vercel sets `x-vercel-cron` on its own invocations and strips that header from
 * anything arriving off the internet, so it cannot be forged from outside. If
 * CRON_SECRET is set, Vercel also sends it as a bearer token — that is the
 * stronger check, so set it.
 */
function isCronRequest(req) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = req.headers.get("authorization") || "";
    if (header === `Bearer ${secret}`) return true;
  }
  return !!req.headers.get("x-vercel-cron");
}

/** Where the report goes: the address set in Admin → Site, then ADMIN_EMAILS. */
async function reportRecipient(svc) {
  try {
    const { data } = await svc
      .from("settings").select("value").eq("key", "admin_email").maybeSingle();
    if (data?.value) return String(data.value).trim();
  } catch (e) {
    console.error("monthly report: could not read admin_email:", e);
  }
  const owner = (process.env.ADMIN_EMAILS || "").split(",")[0].trim();
  return owner || FALLBACK_RECIPIENT;
}

function notConfigured() {
  if (!resend) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not set, so no report can be sent.", info: "resend_missing" },
      { status: 500 });
  }
  // No silent fallback to noreply@resend.dev: Resend refuses to send from a
  // domain this project does not own, and the failure is invisible from here —
  // the mail simply never arrives. Say what is missing instead.
  if (!fromEmail) {
    return NextResponse.json(
      { error: "RESEND_FROM_EMAIL is not set, so no report can be sent.", info: "resend_from_missing" },
      { status: 500 });
  }
  return null;
}

/** Build and send. monthOffset -1 is the month that just ended. */
async function sendReport(monthOffset) {
  const missing = notConfigured();
  if (missing) return missing;

  const svc = getServiceClient();
  const to = await reportRecipient(svc);
  const stats = await getMonthlyStats(monthOffset);

  const result = await resend.emails.send({
    from: fromEmail,
    to,
    subject: `SoftwareVault Monatsbericht - ${stats.month}`,
    html: generateMonthlyReportEmail(stats),
  });

  if (result.error) {
    console.error("monthly report: Resend error:", result.error);
    return NextResponse.json(
      { error: result.error.message || "Could not send the report" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `Monthly report sent to ${to}`,
    sentTo: to,
    stats: { newUsers: stats.totalStats.newUsersThisMonth, month: stats.month },
  });
}

/** The month that just ended, unless the caller asks for the running one. */
function offsetFrom(req) {
  return new URL(req.url).searchParams.get("month") === "current" ? 0 : -1;
}

export async function GET(req) {
  try {
    // the scheduler: send, covering the month that just finished
    if (isCronRequest(req)) return await sendReport(-1);

    const auth = await requireAdmin(req);
    if (auth.response) return auth.response;

    const offset = offsetFrom(req);
    if (new URL(req.url).searchParams.get("preview") === "1") {
      const stats = await getMonthlyStats(offset);
      return NextResponse.json({
        ok: true,
        stats: stats.totalStats,
        newUsers: stats.newUsers.slice(0, 5),
        topDownloads: stats.downloadStats.slice(0, 5),
        month: stats.month,
        recipient: await reportRecipient(auth.svc),
        emailPreview: generateMonthlyReportEmail(stats),
      });
    }
    return await sendReport(offset);
  } catch (error) {
    console.error("monthly report error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate monthly report" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    if (!isCronRequest(req)) {
      const auth = await requireAdmin(req);
      if (auth.response) return auth.response;
    }
    return await sendReport(offsetFrom(req));
  } catch (error) {
    console.error("monthly report error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send monthly report" }, { status: 500 });
  }
}
