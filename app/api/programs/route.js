import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api_auth";
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

    // Transform lowercase column names to camelCase
    const programs = (data ?? []).map(p => ({
      ...p,
      desc: p.description,
      fileUrl: p.fileurl,
      fileName: p.filename,
      fileSize: p.filesize,
      coverImage: p.coverimage,
    }));

    return NextResponse.json({ programs });
  } catch (err) {
    if (isMissingTableError(err)) return NextResponse.json({ programs: [] });
    console.error("Error fetching programs:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch programs" }, { status: 500 });
  }
}

// POST /api/programs - save all programs
// Writing the catalogue is admin-only. This route had NO authentication at all:
// anyone who knew the URL could POST a replacement programs array and wipe or
// rewrite the entire catalogue. It was left open because the download counter
// used it from the browser — that now goes through /api/downloads instead.
export async function POST(req) {
  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;

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

    // Fetch existing rows first. `likes` is maintained by a DB trigger (on the
    // `likes` table), so we PRESERVE the stored value and never overwrite it from
    // the client payload — otherwise a download/edit save would clobber the count.
    const { data: existing, error: fetchErr } = await svc.from("programs").select("id, likes");
    if (fetchErr && !isMissingTableError(fetchErr)) {
      console.error("Error fetching existing programs:", fetchErr);
      throw fetchErr;
    }
    const existingLikes = new Map((existing ?? []).map(p => [p.id, p.likes]));

    // Filter programs to only include fields that exist in the table
    const progsToSave = programs.map(p => ({
      id: p.id,
      name: p.name,
      description: p.desc,
      ver: p.ver,
      cat: p.cat,
      url: p.url,
      fileurl: p.fileUrl,
      filename: p.fileName,
      filesize: p.fileSize,
      os: Array.isArray(p.os) ? p.os : [],
      coverimage: p.coverImage,
      screenshots: Array.isArray(p.screenshots) ? p.screenshots : [],
      downloads: p.downloads || {},
      dl: p.dl || 0,
      likes: existingLikes.has(p.id) ? existingLikes.get(p.id) : (p.likes || 0),
      featured: p.featured || false,
      date: p.date,
    }));

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

