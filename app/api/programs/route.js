// app/api/programs/route.js
// GET  /api/programs          → list all programs (public)
// POST /api/programs          → create program (admin, requires admin-secret header)
// PUT  /api/programs          → update program (admin)
// DELETE /api/programs?id=xx  → delete program (admin)

import { NextResponse } from "next/server";
import { supabase, getServiceClient } from "@/lib/vault_client";

const ADMIN_SECRET = process.env.ADMIN_SECRET; // set in Vercel env vars

function authed(req) {
  return req.headers.get("x-admin-secret") === ADMIN_SECRET;
}

export async function GET() {
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .order("date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const svc  = getServiceClient();
  const { data, error } = await svc.from("programs").insert([body]).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PUT(req) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { id, ...fields } = body;
  const svc  = getServiceClient();
  const { data, error } = await svc.from("programs").update(fields).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req) {
  if (!authed(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const id  = searchParams.get("id");
  const svc = getServiceClient();
  // Delete file from storage if it exists
  const { data: prog } = await svc.from("programs").select("file_path,cover_url,screenshots").eq("id", id).single();
  if (prog?.file_path) await svc.storage.from("files").remove([prog.file_path]);
  const { error } = await svc.from("programs").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}