// Monthly statistics gathering and the report email template.

import { getServiceClient } from "./vault_client";

/**
 * Statistics for one calendar month.
 *
 * @param {number} monthOffset  0 = the month we are in, -1 = the month before.
 *
 * The scheduled report runs at 01:00 on the 1st and passes -1.
 */
export async function getMonthlyStats(monthOffset = 0) {
  const supabase = getServiceClient();
  const now = new Date();
  const base = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
  const monthEnd = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59, 999);
  const monthKey = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;

  try {
    // Signups in the window. PostgREST cannot embed auth.users; it only serves
    // the schemas Supabase exposes.
    const { data: newProfiles, error: usersError } = await supabase
      .from("profiles")
      .select("id, username, created_at")
      .gte("created_at", monthStart.toISOString())
      .lte("created_at", monthEnd.toISOString())
      .order("created_at", { ascending: false });

    if (usersError) throw usersError;

    // Addresses live in auth.users, readable only via the admin API; best effort.
    const emails = new Map();
    try {
      for (let page = 1; page <= 5; page++) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (error) break;
        const batch = data?.users || [];
        for (const u of batch) emails.set(u.id, u.email || "");
        if (batch.length < 200) break;
      }
    } catch (e) {
      console.error("monthly stats: could not read addresses:", e);
    }

    const newUsers = (newProfiles || []).map((p) => ({
      ...p,
      email: emails.get(p.id) || "",
    }));

    // Programs and their counters. dl_by_month is absent on older databases, so
    // fall back to the columns every schema version has rather than failing.
    const FULL = "id, name, dl, likes, dl_by_month";
    const MINIMAL = "id, name, dl, likes";
    let { data: programs, error: programsError } =
      await supabase.from("programs").select(FULL);
    if (programsError) {
      console.error("monthly stats: retrying without dl_by_month:", programsError.message);
      ({ data: programs, error: programsError } =
        await supabase.from("programs").select(MINIMAL));
      if (programsError) throw programsError;
    }
    programs = programs || [];

    const downloadStats = programs
      .map((prog) => {
        // dl_by_month is written by increment_program_downloads and looks like
        // {"2026-08": 12}; months before that migration legitimately read 0.
        let monthDownloads = 0;
        if (prog.dl_by_month && typeof prog.dl_by_month === "object") {
          monthDownloads = Number(prog.dl_by_month[monthKey]) || 0;
        }
        return {
          id: prog.id,
          name: prog.name,
          totalDownloads: prog.dl || 0,
          monthDownloads,
          likes: prog.likes || 0,
        };
      })
      .filter((p) => p.monthDownloads > 0 || p.totalDownloads > 0)
      // lifetime total breaks ties, so months with no per-month figures still rank
      .sort((a, b) => (b.monthDownloads - a.monthDownloads)
                   || (b.totalDownloads - a.totalDownloads));

    // head:true returns the count only, without fetching every row
    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });

    const totalDownloads = programs.reduce((sum, p) => sum + (p.dl || 0), 0);
    const totalLikes = programs.reduce((sum, p) => sum + (p.likes || 0), 0);

    return {
      month: base.toLocaleDateString("de-DE", { month: "long", year: "numeric" }),
      monthKey,
      newUsers,
      downloadStats,
      programs,
      totalStats: {
        newUsersThisMonth: newUsers.length,
        totalUsers: totalUsers || 0,
        totalDownloads,
        totalLikes,
      },
    };
  } catch (error) {
    console.error("Error fetching monthly stats:", error);
    throw error;
  }
}

export function generateMonthlyReportEmail(stats) {
  const { month, newUsers, downloadStats, totalStats } = stats;

  const userListHTML = newUsers
    .slice(0, 20)
    .map(
      (user) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${
        user.username || "—"
      }</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${
        user.email || "—"
      }</td>
    </tr>
  `
    )
    .join("");

  const topDownloadsHTML = downloadStats
    .slice(0, 10)
    .map(
      (prog, idx) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${
        idx + 1
      }.</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; font-weight: 500;">${
        prog.name
      }</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px;"><strong>${
        prog.monthDownloads
      }</strong></td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px; color: #666;">${
        prog.totalDownloads
      }</td>
    </tr>
  `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9fafb;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 800px;
      margin: 0 auto;
      background-color: #ffffff;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .header p {
      margin: 8px 0 0 0;
      font-size: 16px;
      opacity: 0.95;
    }
    .content {
      padding: 40px 30px;
    }
    .section {
      margin-bottom: 40px;
    }
    .section-title {
      font-size: 20px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 20px 0;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 20px;
      margin-bottom: 30px;
    }
    @media (max-width: 600px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
    .stat-card {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-card.alt {
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    }
    .stat-value {
      font-size: 36px;
      font-weight: 700;
      margin: 0;
    }
    .stat-label {
      font-size: 14px;
      opacity: 0.9;
      margin: 8px 0 0 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th {
      background-color: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #1f2937;
      border-bottom: 2px solid #d1d5db;
    }
    td {
      padding: 8px 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    .footer {
      background-color: #f9fafb;
      padding: 30px;
      text-align: center;
      font-size: 12px;
      color: #666;
      border-top: 1px solid #e5e7eb;
    }
    .footer-links {
      margin-top: 15px;
    }
    .footer-links a {
      color: #667eea;
      text-decoration: none;
      margin: 0 15px;
    }
    .empty-state {
      text-align: center;
      color: #999;
      padding: 20px;
      background-color: #f9fafb;
      border-radius: 6px;
      font-size: 14px;
    }
    .highlight {
      background-color: #fef3c7;
      padding: 2px 6px;
      border-radius: 3px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1>📊 SoftwareVault Monatsbericht</h1>
      <p>${month}</p>
    </div>

    <!-- Content -->
    <div class="content">
      <!-- Overview Stats -->
      <div class="section">
        <h2 class="section-title">📈 Überblick</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${totalStats.newUsersThisMonth}</div>
            <div class="stat-label">Neue Benutzer</div>
          </div>
          <div class="stat-card alt">
            <div class="stat-value">${totalStats.totalDownloads.toLocaleString()}</div>
            <div class="stat-label">Gesamt Downloads</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${totalStats.totalUsers.toLocaleString()}</div>
            <div class="stat-label">Registrierte Benutzer</div>
          </div>
          <div class="stat-card alt">
            <div class="stat-value">${totalStats.totalLikes.toLocaleString()}</div>
            <div class="stat-label">Gesamte Likes</div>
          </div>
        </div>
      </div>

      <!-- New Users Section -->
      <div class="section">
        <h2 class="section-title">👥 Neue Benutzer (${newUsers.length})</h2>
        ${
          newUsers.length > 0
            ? `
          <table>
            <thead>
              <tr>
                <th>Benutzername</th>
                <th>E-Mail</th>
              </tr>
            </thead>
            <tbody>
              ${userListHTML}
            </tbody>
          </table>
          ${
            newUsers.length > 20
              ? `<p style="text-align: center; color: #999; font-size: 13px; margin-top: 15px;">... und ${newUsers.length - 20} weitere</p>`
              : ""
          }
        `
            : '<div class="empty-state">Keine neuen Benutzer diesen Monat</div>'
        }
      </div>

      <!-- Top Downloads Section -->
      <div class="section">
        <h2 class="section-title">⬇️ Top Downloads</h2>
        ${
          downloadStats.length > 0
            ? `
          <table>
            <thead>
              <tr>
                <th style="width: 30px;">#</th>
                <th>Programm</th>
                <th style="text-align: center;">Diesen Monat</th>
                <th style="text-align: center;">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              ${topDownloadsHTML}
            </tbody>
          </table>
        `
            : '<div class="empty-state">Keine Downloads diesen Monat</div>'
        }
      </div>

      <!-- Highlights -->
      <div class="section" style="background-color: #f0f4ff; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea;">
        <h2 class="section-title" style="border-bottom: none; margin-bottom: 10px;">✨ Highlights</h2>
        <ul style="margin: 0; padding-left: 20px; color: #1f2937;">
          <li>Diese Monatsprüfung wurde automatisch generiert</li>
          <li>Alle Statistiken basieren auf Daten bis zum Ende des Monats</li>
          <li>Für Details besuchen Sie die Admin-Konsole</li>
        </ul>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 0 0 10px 0;">© 2024 SoftwareVault. Alle Rechte vorbehalten.</p>
      <div class="footer-links">
        <a href="https://softwarevault.dev">Website</a>
        <a href="https://softwarevault.dev/admin">Admin Panel</a>
      </div>
      <p style="margin: 15px 0 0 0; font-size: 11px; color: #999;">
        Dies ist eine automatisch generierte Nachricht. Bitte antworten Sie nicht auf diese E-Mail.
      </p>
    </div>
  </div>
</body>
</html>
  `.trim();
}
