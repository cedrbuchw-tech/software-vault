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
    const body = await req.json().catch(() => ({}));
    const programs = body.programs;

    if (!Array.isArray(programs)) {
      console.error("Invalid programs array:", programs);
      return NextResponse.json({ error: "Invalid programs array" }, { status: 400 });
    }

    console.log("Saving programs to Supabase:", programs.length, "programs");

    const svc = getServiceClient();

    // Filter programs to only include fields that exist in the table
    const progsToSave = programs.map(p => ({
      id: p.id,
      name: p.name,
      desc: p.desc,
      ver: p.ver,
      cat: p.cat,
      url: p.url,
      fileUrl: p.fileUrl,
      fileName: p.fileName,
      fileSize: p.fileSize,
      os: Array.isArray(p.os) ? p.os : [],
      coverImage: p.coverImage,
      screenshots: Array.isArray(p.screenshots) ? p.screenshots : [],
      dl: p.dl || 0,
      likes: p.likes || 0,
      featured: p.featured || false,
      date: p.date,
    }));

    // Get existing program IDs
    const { data: existing, error: fetchErr } = await svc.from("programs").select("id");
    if (fetchErr && !isMissingTableError(fetchErr)) {
      console.error("Error fetching existing programs:", fetchErr);
      throw fetchErr;
    }

    const existingIds = new Set(existing?.map(p => p.id) ?? []);
    const incomingIds = new Set(programs.map(p => p.id).filter(id => id));

    // Delete programs not in the incoming list
    const toDelete = Array.from(existingIds).filter(id => !incomingIds.has(id));
    if (toDelete.length > 0) {
      console.log("Deleting programs:", toDelete);
      const { error: delErr } = await svc.from("programs").delete().in("id", toDelete);
      if (delErr && !isMissingTableError(delErr)) {
        console.error("Error deleting programs:", delErr);
        throw delErr;
      }
    }

    // Upsert incoming programs
    if (progsToSave.length > 0) {
      console.log("Upserting programs:", progsToSave.length);
      const { error: upsertErr } = await svc.from("programs").upsert(progsToSave);
      if (upsertErr && !isMissingTableError(upsertErr)) {
        console.error("Error upserting programs:", upsertErr);
        throw upsertErr;
      }
    }

    console.log("Successfully saved programs to Supabase");
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (isMissingTableError(err)) {
      console.log("Table doesn't exist yet, skipping sync");
      return NextResponse.json({ ok: true });
    }
    console.error("Fatal error in programs endpoint:", err);
    return NextResponse.json({ error: err.message || "Failed to save programs" }, { status: 500 });
  }
}

