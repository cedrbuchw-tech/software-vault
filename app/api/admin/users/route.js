import { NextResponse } from "next/server";
import { requireAdmin, isOwnerEmail, rateLimit, clientKey, tooMany } from "@/lib/api_auth";

// Admin-only user management.
//
//   GET  /api/admin/users?q=…      -> { users: [{ id, email, username, isAdmin, owner }] }
//   POST /api/admin/users          body { userId, isAdmin } -> { ok, user }
//
// Admin rights are the `is_admin` column on profiles. Demotion guards: not
// yourself, not an ADMIN_EMAILS address, not the last remaining admin.

const PAGE_SIZE = 200;
const MAX_PAGES = 5;          // 1000 accounts is plenty for this site

/** Page through the admin user list; one page rarely covers everyone. */
async function listAllUsers(svc) {
  const all = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await svc.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) throw error;
    const batch = data?.users || [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) return { users: all, truncated: false };
  }
  return { users: all, truncated: true };
}

function shape(user, profile) {
  return {
    id: user.id,
    email: user.email || "",
    username: profile?.username || user.user_metadata?.username || "",
    isAdmin: !!profile?.is_admin || isOwnerEmail(user.email),
    owner: isOwnerEmail(user.email),
    createdAt: user.created_at || null,
  };
}

export async function GET(req) {
  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;

  try {
    const q = (new URL(req.url).searchParams.get("q") || "").trim().toLowerCase();

    const { users, truncated } = await listAllUsers(auth.svc);
    const ids = users.map((u) => u.id);

    // Chunked: a thousand ids in one `in(…)` makes a URL PostgREST refuses.
    const byId = new Map();
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await auth.svc
        .from("profiles").select("id, username, is_admin").in("id", ids.slice(i, i + 100));
      if (error) throw error;
      for (const p of data || []) byId.set(p.id, p);
    }

    let rows = users.map((u) => shape(u, byId.get(u.id)));
    if (q) {
      rows = rows.filter((r) =>
        r.email.toLowerCase().includes(q) || r.username.toLowerCase().includes(q));
    }
    // admins first, then alphabetical
    rows.sort((a, b) =>
      (b.isAdmin - a.isAdmin) || (a.username || a.email).localeCompare(b.username || b.email));

    return NextResponse.json({ users: rows, truncated });
  } catch (err) {
    console.error("admin users GET error:", err);
    return NextResponse.json({ error: err.message || "Could not load users" }, { status: 500 });
  }
}

export async function POST(req) {
  if (!rateLimit("admin-users:" + clientKey(req), 30, 60_000)) return tooMany();

  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;

  try {
    const { userId, isAdmin } = await req.json().catch(() => ({}));
    if (!userId || typeof isAdmin !== "boolean") {
      return NextResponse.json({ error: "Expected { userId, isAdmin }" }, { status: 400 });
    }

    const { data: target, error: getErr } = await auth.svc.auth.admin.getUserById(userId);
    if (getErr || !target?.user) {
      return NextResponse.json({ error: "No such user" }, { status: 404 });
    }
    const targetUser = target.user;

    if (!isAdmin) {
      if (userId === auth.user.id) {
        return NextResponse.json({
          error: "You can't remove your own admin rights — ask another admin to do it.",
        }, { status: 400 });
      }
      if (isOwnerEmail(targetUser.email)) {
        return NextResponse.json({
          error: "This address is listed in ADMIN_EMAILS and always stays an admin.",
        }, { status: 400 });
      }
      const { data: admins, error: cErr } = await auth.svc
        .from("profiles").select("id").eq("is_admin", true);
      if (cErr) throw cErr;
      if ((admins || []).length <= 1) {
        return NextResponse.json({
          error: "That's the last admin — promote someone else first.",
        }, { status: 400 });
      }
    }

    // The sign-up trigger creates the profile row, but older accounts may have
    // none, so insert when the update matches nothing.
    const { data: rows, error: upErr } = await auth.svc
      .from("profiles").update({ is_admin: isAdmin }).eq("id", userId).select("id");
    if (upErr) throw upErr;
    if (!rows || rows.length === 0) {
      const { error: insErr } = await auth.svc.from("profiles").insert({
        id: userId,
        username: targetUser.user_metadata?.username || (targetUser.email || "").split("@")[0],
        is_admin: isAdmin,
      });
      if (insErr) throw insErr;
    }

    const { data: profile } = await auth.svc
      .from("profiles").select("id, username, is_admin").eq("id", userId).maybeSingle();

    return NextResponse.json({ ok: true, user: shape(targetUser, profile) });
  } catch (err) {
    console.error("admin users POST error:", err);
    return NextResponse.json({ error: err.message || "Could not update the user" }, { status: 500 });
  }
}
