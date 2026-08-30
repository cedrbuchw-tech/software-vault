import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";

// POST /api/downloads   body { programId }   -> { ok: true, dl: <new count> }
//
// Registers one completed download, called by the website and by VaultLaunch.
// Public on purpose: the whole surface is "add 1 to one counter", so it needs no
// catalog write access.
//
// Prefers the atomic SQL function from MIGRATION_DOWNLOAD_COUNTER.sql; without
// that migration it falls back to read-then-write, which is not race-proof.

const SUPABASE_ENABLED = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function POST(req) {
  if (!SUPABASE_ENABLED) return NextResponse.json({ ok: true, dl: null });

  try {
    const body = await req.json().catch(() => ({}));
    const programId = body.programId;
    if (!programId) {
      return NextResponse.json({ error: "programId required" }, { status: 400 });
    }

    const svc = getServiceClient();

    // Preferred path: one atomic UPDATE ... RETURNING inside the database.
    const { data, error } = await svc.rpc("increment_program_downloads", { pid: String(programId) });
    if (!error) {
      if (data === null || data === undefined) {
        return NextResponse.json({ error: "Unknown program" }, { status: 404 });
      }
      return NextResponse.json({ ok: true, dl: data });
    }

    // Fallback: the migration isn't installed yet.
    const { data: row, error: readErr } = await svc
      .from("programs").select("dl").eq("id", programId).single();
    if (readErr || !row) {
      return NextResponse.json({ error: "Unknown program" }, { status: 404 });
    }
    const next = (row.dl || 0) + 1;
    const { error: writeErr } = await svc
      .from("programs").update({ dl: next }).eq("id", programId);
    if (writeErr) throw writeErr;
    return NextResponse.json({ ok: true, dl: next });
  } catch (err) {
    console.error("download count error:", err);
    return NextResponse.json({ error: err.message || "Failed" }, { status: 500 });
  }
}
