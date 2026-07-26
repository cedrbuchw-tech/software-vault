import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getMonthlyStats, generateMonthlyReportEmail } from "@/lib/monthly_stats";
import { getServiceClient } from "@/lib/vault_client";

const resendKey = process.env.RESEND_API_KEY;
const resend = resendKey ? new Resend(resendKey) : null;
const fromEmail = process.env.RESEND_FROM_EMAIL || "noreply@resend.dev";
const adminEmail = "CedrBuchw@gmail.com"; // Only recipient

/**
 * POST /api/admin/monthly-report
 * Generates and sends the monthly report email
 * Protected by admin authentication
 */
export async function POST(req) {
  try {
    // Check admin authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = getServiceClient();

    // Verify JWT token
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Check if email service is configured
    if (!resend) {
      return NextResponse.json(
        { error: "Email service not configured", info: "resend_missing" },
        { status: 500 }
      );
    }

    // Generate statistics
    const stats = await getMonthlyStats();

    // Generate email HTML
    const emailHTML = generateMonthlyReportEmail(stats);

    // Send email
    const result = await resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject: `SoftwareVault Monatsbericht - ${stats.month}`,
      html: emailHTML,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      message: "Monthly report sent successfully",
      stats: {
        newUsers: stats.totalStats.newUsersThisMonth,
        month: stats.month,
      },
    });
  } catch (error) {
    console.error("Monthly report error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate monthly report" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/monthly-report
 * Returns preview of monthly statistics (for testing)
 * Protected by admin authentication
 */
export async function GET(req) {
  try {
    // Check admin authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const supabase = getServiceClient();

    // Verify JWT token
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    // Generate statistics
    const stats = await getMonthlyStats();

    // Generate email HTML
    const emailHTML = generateMonthlyReportEmail(stats);

    return NextResponse.json({
      ok: true,
      stats: stats.totalStats,
      newUsers: stats.newUsers.slice(0, 5),
      topDownloads: stats.downloadStats.slice(0, 5),
      month: stats.month,
      emailPreview: emailHTML,
    });
  } catch (error) {
    console.error("Monthly report preview error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to preview monthly report" },
      { status: 500 }
    );
  }
}
