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
      if (await checkAdmin(auth.svc, auth.user)) return NextResponse.json({ ok: true });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (body.action === 'set_email') {
      const auth = await authUser(req);
      if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
      if (!(await checkAdmin(auth.svc, auth.user))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    // "Does any admin exist yet?" — this only decides whether the one-time
    // "set up admin" prompt is needed, so it must NOT be fatal.
    //
    // It used to `throw error`, which took the whole endpoint down with a 500
    // BEFORE the caller's own rights were ever looked at. If profiles.is_admin
    // is missing — SETUP_SUPABASE.sql not run, or run before that column
    // existed — nobody could be recognised as an admin, and ADMIN_EMAILS could
    // not rescue them either, because the route never got that far.
    let problem = null;
    let problemKind = null;      // 'error' = something is broken, 'not_admin' = normal
    const { data: admins, error } = await svc
      .from('profiles').select('id').eq('is_admin', true).limit(1);
    if (error) {
      problem = `profiles.is_admin is not readable: ${error.message}`;
      problemKind = 'error';
      console.error('admin GET: could not count admins:', error);
    }
    // ADMIN_EMAILS counts as an admin existing, so the prompt stays away on a
    // site that is already configured that way.
    const exists = (admins && admins.length > 0) || hasOwnerEmails();

    // If caller provided a bearer token, check if they are admin
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

    // admin email (optional) — read from settings if present
    // maybeSingle: with no row saved yet, single() answers with an error that was
    // being thrown away here, which looked identical to "nothing is stored"
    const { data: s, error: sErr } = await svc
      .from('settings').select('value').eq('key', 'admin_email').maybeSingle();
    if (sErr) console.error('admin GET: could not read admin_email:', sErr);
    // An admin may see the address they just typed in; anyone else gets it
    // masked, because this endpoint also answers callers with no token at all.
    const adminEmail = s && s.value ? (authed ? s.value : maskEmail(s.value)) : null;

    // `problem` is only ever a diagnosis of why `authed` came back false — it
    // is what turns "the panel just isn't there" into something you can read.
    return NextResponse.json({ exists, authed, adminEmail, problem, problemKind });
  } catch (err) {
    console.error('admin GET error:', err);
    return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
  }
}
