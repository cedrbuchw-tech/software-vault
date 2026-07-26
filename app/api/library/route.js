import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";

// /api/library — the signed-in user's personal library ("My Apps").
// The launcher (or any client) authenticates with the user's Supabase access
// token: send  Authorization: Bearer <access_token>.  The token is validated
// server-side and the user id is taken from it, so a caller can only ever read
// or change their OWN library.
//
//   GET    /api/library            -> { library: [ ...full program objects ] }
//   POST   /api/library            body { programId }   -> { ok: true }
//   DELETE /api/library?programId=  (or body { programId }) -> { ok: true }

const SUPABASE_ENABLED = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

function mapProgram(p) {
  return {
    ...p,
    desc: p.description,
    fileUrl: p.fileurl,
    fileName: p.filename,
    fileSize: p.filesize,
    coverImage: p.coverimage,
  };
}

// Validate the bearer token and resolve the user it belongs to.
async function authUser(req) {
  const header = req.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) return { error: "Missing bearer token", status: 401 };
  const svc = getServiceClient();
  const { data, error } = await svc.auth.getUser(token);
  if (error || !data?.user) return { error: "Invalid or expired token", status: 401 };
  return { user: data.user, svc };
}

export async function GET(req) {
  if (!SUPABASE_ENABLED) return NextResponse.json({ library: [] });
  const a = await authUser(req);
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    const { data: rows, error } = await a.svc.from("library").select("program_id").eq("user_id", a.user.id);
    if (error) throw error;
    const ids = (rows ?? []).map(r => r.program_id);
    if (ids.length === 0) return NextResponse.json({ library: [] });
    const { data: progs, error: pe } = await a.svc.from("programs").select("*").in("id", ids);
    if (pe) throw pe;
    return NextResponse.json({ library: (progs ?? []).map(mapProgram) });
  } catch (err) {
    console.error("library GET error:", err);
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req) {
  if (!SUPABASE_ENABLED) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const a = await authUser(req);
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    const body = await req.json().catch(() => ({}));
    const programId = body.programId;
    if (!programId) return NextResponse.json({ error: "programId required" }, { status: 400 });
    const { error } = await a.svc.from("library").upsert({ user_id: a.user.id, program_id: programId });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("library POST error:", err);
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(req) {
  if (!SUPABASE_ENABLED) return NextResponse.json({ error: "Not configured" }, { status: 503 });
  const a = await authUser(req);
  if (a.error) return NextResponse.json({ error: a.error }, { status: a.status });
  try {
    let programId = new URL(req.url).searchParams.get("programId");
    if (!programId) { const body = await req.json().catch(() => ({})); programId = body.programId; }
    if (!programId) return NextResponse.json({ error: "programId required" }, { status: 400 });
    const { error } = await a.svc.from("library").delete().eq("user_id", a.user.id).eq("program_id", programId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("library DELETE error:", err);
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
