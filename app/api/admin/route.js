import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";
import { checkAdmin, hasOwnerEmails } from "@/lib/api_auth";

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

  // action='setup' lets the first authenticated user claim admin rights; every
  // other action requires the caller to already have profiles.is_admin.
  try {
    if (body.action === 'setup') {
      if (!SUPABASE_ENABLED) return NextResponse.json({ error: 'Not configured' }, { status: 503 });
      const auth = await authUser(req);
      if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
      const svc = auth.svc;
      const { data: existingAdmins, error: e } = await svc.from('profiles').select('id').eq('is_admin', true).limit(1);
      if (e) throw e;
      if (existingAdmins && existingAdmins.length > 0) return NextResponse.json({ error: 'Admin already exists' }, { status: 400 });
      const { error: up } = await svc.from('profiles').update({ is_admin: true }).eq('id', auth.user.id);
      if (up) throw up;
      return NextResponse.json({ ok: true });
    }

    if (body.action === 'login') {
      const auth = await authUser(req);
      if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
      if (await checkAdmin(auth.svc, auth.user)) return NextResponse.json({ ok: true });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (body.action === 'set_email') {
      const auth = await authUser(req);
      if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
      if (!(await checkAdmin(auth.svc, auth.user))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      const email = (body.email || '').trim().toLowerCase();
      if (!email || !email.includes('@')) return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
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

    // Only decides whether the one-time "set up admin" prompt is needed, so a
    // failure here must not be fatal; ADMIN_EMAILS can still grant access.
    let problem = null;
    let problemKind = null;      // 'error' = something is broken, 'not_admin' = normal
    const { data: admins, error } = await svc
      .from('profiles').select('id').eq('is_admin', true).limit(1);
    if (error) {
      problem = `profiles.is_admin is not readable: ${error.message}`;
      problemKind = 'error';
      console.error('admin GET: could not count admins:', error);
    }
    // ADMIN_EMAILS counts as an admin existing, so the prompt stays away.
    const exists = (admins && admins.length > 0) || hasOwnerEmails();

    const header = req.headers.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    let authed = false;
    if (token) {
      const { data, error: e } = await svc.auth.getUser(token);
      if (e || !data?.user) {
        if (!problem) {
          problem = `the access token was rejected: ${e?.message || 'no user'}`;
          problemKind = 'error';
        }
      } else {
        authed = await checkAdmin(svc, data.user);
        if (!authed && !problem) {
          problem = `${data.user.email} is not an admin — profiles.is_admin is false `
                  + `and the address is not in ADMIN_EMAILS`;
          problemKind = 'not_admin';
        }
      }
    }

    // maybeSingle: single() errors when no admin_email row is stored yet.
    const { data: s, error: sErr } = await svc
      .from('settings').select('value').eq('key', 'admin_email').maybeSingle();
    if (sErr) console.error('admin GET: could not read admin_email:', sErr);
    // This endpoint also answers callers with no token, so mask unless admin.
    const adminEmail = s && s.value ? (authed ? s.value : maskEmail(s.value)) : null;

    // `problem` only ever diagnoses why `authed` came back false.
    return NextResponse.json({ exists, authed, adminEmail, problem, problemKind });
  } catch (err) {
    console.error('admin GET error:', err);
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}
