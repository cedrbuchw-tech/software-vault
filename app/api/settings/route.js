// app/api/settings/route.js
// GET /api/settings        → get all settings (public)
// POST /api/settings       → upsert a setting {key, value} (admin)

import { NextResponse } from "next/server";
import { supabase, getServiceClient } from "@/lib/vault_client";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function GET() {
  const { data, error } = await supabase.from("settings").select("*");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Return as a flat object: { ann: {...}, support: {...}, heroSub: "..." }
  const out = {};
  for (const row of data ?? []) out[row.key] = row.value;
  return NextResponse.json(out);
}

export async function POST(req) {
  if (req.headers.get("x-admin-secret") !== ADMIN_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { key, value } = await req.json();
  const svc = getServiceClient();
  const { error } = await svc.from("settings").upsert({ key, value });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}