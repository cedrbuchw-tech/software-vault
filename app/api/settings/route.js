import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";
import { requireAdmin } from "@/lib/api_auth";

// Site settings: the announcement banner, the support/donation block, the hero
// subtitle and the secret-download config.
//
//   GET  /api/settings            public  -> { settings }
//   POST /api/settings   (admin)          -> { ok }
//
// Stored as one JSON blob under a single key in the `settings` table.
//
// The public response includes secretDownloads and their links, because the site
// reveals rewards client-side, so anyone reading this endpoint sees them without
// earning them.

const KEY = "site_settings";

export async function GET() {
  try {
    const svc = getServiceClient();
    const { data, error } = await svc
      .from("settings").select("value").eq("key", KEY).maybeSingle();
    if (error) throw error;

    let settings = null;
    if (data?.value) {
      try { settings = JSON.parse(data.value); }
      catch (e) { console.error("settings GET: stored value is not JSON:", e); }
    }
    return NextResponse.json({ settings });
  } catch (err) {
    console.error("settings GET error:", err);
    // Never fail the whole page over settings; the client falls back to its copy.
    return NextResponse.json({ settings: null, error: err.message || "Failed" }, { status: 200 });
  }
}

export async function POST(req) {
  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;

  try {
    const { settings } = await req.json().catch(() => ({}));
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return NextResponse.json({ error: "Expected { settings: {...} }" }, { status: 400 });
    }

    const value = JSON.stringify(settings);
    // the column is TEXT; keep a runaway blob out of it
    if (value.length > 512_000) {
      return NextResponse.json({ error: "Settings are too large to store." }, { status: 413 });
    }

    const { error } = await auth.svc.from("settings").upsert({ key: KEY, value });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("settings POST error:", err);
    return NextResponse.json({ error: err.message || "Could not save settings" }, { status: 500 });
  }
}
