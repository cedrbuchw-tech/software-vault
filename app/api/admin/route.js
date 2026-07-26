import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";

const SUPABASE_ENABLED = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

function maskEmail(email) {
  if (!email || typeof email !== "string") return "hidden email";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 1)}${local.length > 2 ? "***" : ""}${local.slice(-1)}@${domain}`;
}

// Validate bearer token and return { user, svc } or error.
async function authUser(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return { error: "Missing bearer token", status: 401 };
  const svc = getServiceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) return { error: "Invalid or expired token", status: 401 };
  return { user: data.user, svc };
}

export async function POST(req) {
  const body = await req.json().catch(()=>null);
  if(!body || !body.action) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // Admin setup: the first signed-up user can claim admin rights by calling
  // action='setup' while authenticated. Other admin actions require the
  // caller to be authenticated and have `is_admin` on their profile.
  try {
    if (body.action === 'setup') {
      if (!SUPABASE_ENABLED) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
      const auth = await authUser(req);
      if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
      const svc = auth.svc;
      // Check if any admin exists
      const { data: existingAdmins, error: e } = await svc.from('profiles').select('id').eq('is_admin', true).limit(1);
      if (e) throw e;
      if (existingAdmins && existingAdmins.length > 0) return NextResponse.json({ error: 'Admin already exists' }, { status: 400 });
      // Promote this user to admin
      const { error: up } = await svc.from('profiles').update({ is_admin: true }).eq('id', auth.user.id);
      if (up) throw up;
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'login') {
      const auth = await authUser(req);
      if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
      const { data: p, error } = await auth.svc.from('profiles').select('is_admin').eq('id', auth.user.id).single();
      if (error) throw error;
      if (p && p.is_admin) return NextResponse.json({ ok: true });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (body.action === 'set_email') {
      const auth = await authUser(req);
      if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
      const { data: p, error } = await auth.svc.from('profiles').select('is_admin').eq('id', auth.user.id).single();
      if (error) throw error;
      if (!p || !p.is_admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const email = (body.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
      // store as settings.admin_email for continuity
      const { error: w } = await auth.svc.from('settings').upsert({ key: 'admin_email', value: email });
      if (w) throw w;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Unknown or unsupported action' }, { status: 400 });
  } catch (err) {
    console.error('admin POST error:', err);
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    if (!SUPABASE_ENABLED) return NextResponse.json({ exists: false, authed: false, adminEmail: null });
    const svc = getServiceClient();
    const { data: admins, error } = await svc.from('profiles').select('id').eq('is_admin', true).limit(1);
    if (error) throw error;
    const exists = (admins && admins.length > 0);

    // If caller provided a bearer token, check if they are admin
    const header = req.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    let authed = false;
    if (token) {
      const { data, error: e } = await svc.auth.getUser(token);
      if (!e && data?.user) {
        const { data: p } = await svc.from('profiles').select('is_admin').eq('id', data.user.id).single();
        authed = !!(p && p.is_admin);
      }
    }

    // admin email (optional) — read from settings if present
    const { data: s } = await svc.from('settings').select('value').eq('key', 'admin_email').single();
    const adminEmail = s && s.value ? maskEmail(s.value) : null;

    return NextResponse.json({ exists, authed, adminEmail });
  } catch (err) {
    console.error('admin GET error:', err);
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}
