import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";

// GET /api/catalog
// Public, read-only list of every published program — what the VaultLaunch
// launcher (and the mobile app) calls to show the store. Mirrors the camelCase
// shape the website uses.

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

export async function GET() {
  if (!SUPABASE_ENABLED) return NextResponse.json({ programs: [] });
  try {
    const svc = getServiceClient();
    const { data, error } = await svc.from("programs").select("*").order("date", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ programs: (data ?? []).map(mapProgram) });
  } catch (err) {
    console.error("catalog error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch catalog" }, { status: 500 });
  }
}
