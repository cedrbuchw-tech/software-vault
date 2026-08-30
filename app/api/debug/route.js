import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";

// Require the caller to be authenticated and an admin (profiles.is_admin).
async function authUser(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return { error: "Missing bearer token", status: 401 };
  const svc = getServiceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) return { error: "Invalid or expired token", status: 401 };
  const { data: p, error: pe } = await svc.from('profiles').select('is_admin').eq('id', data.user.id).single();
  if (pe) return { error: 'Failed to read profile', status: 500 };
  if (!p || !p.is_admin) return { error: 'Unauthorized', status: 401 };
  return { user: data.user, svc };
}

export async function GET(req) {
  const a = await authUser(req);
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });

  const SUPABASE_ENABLED = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_ENABLED) {
    return NextResponse.json({
      error: "Supabase not configured",
      supabaseEnabled: false
    });
  }

  try {
    const svc = getServiceClient();

    // connection test
    const { data, error } = await svc.from("programs").select("*").limit(1);

    if (error) {
      return NextResponse.json({
        error: error.message,
        errorCode: error.code,
        tableExists: false,
      }, { status: 500 });
    }

    const { count, error: countErr } = await svc.from("programs").select("*", { count: "exact", head: true });

    if (countErr) {
      return NextResponse.json({
        error: countErr.message,
        tableExists: false,
      }, { status: 500 });
    }

    return NextResponse.json({
      status: "ok",
      tableExists: true,
      programsInDatabase: count || 0,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
  } catch (err) {
    return NextResponse.json({
      error: err.message,
      status: "error",
    }, { status: 500 });
  }
}
