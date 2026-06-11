import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";

const SUPABASE_ENABLED = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

function isMissingTableError(err) {
  return !!err?.message?.includes("Could not find the table") || !!err?.message?.includes("does not exist") || !!err?.message?.includes("table \"public.programs\"");
}

// GET /api/programs - fetch all programs
export async function GET(req) {
  if (!SUPABASE_ENABLED) return NextResponse.json({ programs: [] });

  try {
    const svc = getServiceClient();
    const { data, error } = await svc.from("programs").select("*").order("date", { ascending: false });

    if (error) {
      if (isMissingTableError(error)) return NextResponse.json({ programs: [] });
      throw error;
    }

    return NextResponse.json({ programs: data ?? [] });
  } catch (err) {
    if (isMissingTableError(err)) return NextResponse.json({ programs: [] });
    console.error("Error fetching programs:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch programs" }, { status: 500 });
  }
}

// POST /api/programs - save all programs
export async function POST(req) {
  if (!SUPABASE_ENABLED) return NextResponse.json({ ok: true });

  try {
    const { programs } = await req.json().catch(() => ({ programs: [] }));
    if (!Array.isArray(programs)) return NextResponse.json({ error: "Invalid programs array" }, { status: 400 });

    const svc = getServiceClient();

    // Get existing program IDs
    const { data: existing, error: fetchErr } = await svc.from("programs").select("id");
    if (fetchErr && !isMissingTableError(fetchErr)) throw fetchErr;

    const existingIds = new Set(existing?.map(p => p.id) ?? []);
    const incomingIds = new Set(programs.map(p => p.id).filter(id => id));

    // Delete programs not in the incoming list
    const toDelete = Array.from(existingIds).filter(id => !incomingIds.has(id));
    if (toDelete.length > 0) {
      const { error: delErr } = await svc.from("programs").delete().in("id", toDelete);
      if (delErr && !isMissingTableError(delErr)) throw delErr;
    }

    // Upsert incoming programs
    if (programs.length > 0) {
      const { error: upsertErr } = await svc.from("programs").upsert(programs);
      if (upsertErr && !isMissingTableError(upsertErr)) throw upsertErr;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isMissingTableError(err)) return NextResponse.json({ ok: true });
    console.error("Error saving programs:", err);
    return NextResponse.json({ error: err.message || "Failed to save programs" }, { status: 500 });
  }
}
