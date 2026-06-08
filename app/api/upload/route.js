// app/api/upload/route.js
// POST /api/upload  — uploads a file to Supabase Storage, returns its public URL
// Accepts multipart/form-data with a "file" field

import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function POST(req) {
  if (req.headers.get("x-admin-secret") !== ADMIN_SECRET)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file     = formData.get("file");
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const ext      = file.name.split(".").pop();
  const path     = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer   = Buffer.from(await file.arrayBuffer());
  const svc      = getServiceClient();

  const { error } = await svc.storage
    .from("files")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: { publicUrl } } = svc.storage.from("files").getPublicUrl(path);
  return NextResponse.json({ url: publicUrl, path, size: file.size, name: file.name });
}