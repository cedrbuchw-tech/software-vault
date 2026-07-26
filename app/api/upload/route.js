import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";
import { requireAdmin } from "@/lib/api_auth";

// Uploading writes to public storage under this project's name, so it is
// admin-only. It used to be completely open: anyone could push arbitrary files
// of any size into the bucket and hand out links on this domain.
const MAX_BYTES = 500 * 1024 * 1024;   // 500 MB

export async function POST(req) {
  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)` },
        { status: 413 });
    }

    const svc = getServiceClient();
    const bucket = "programs";
    const rawName = String(formData.get("fileName") || file.name || "upload.bin");
    const fileSize = file.size;

    // Keep the stored name tame: no directory traversal, no exotic characters.
    const safeName = rawName
      .split(/[\\/]/).pop()
      .replace(/[^A-Za-z0-9._-]/g, "_")
      .slice(0, 120) || "upload.bin";
    const storagePath = `${Date.now()}-${safeName}`;
    const fileName = safeName;

    // Convert file to buffer
    const buffer = await file.arrayBuffer();

    // Upload to Supabase Storage
    const { data, error } = await svc.storage
      .from(bucket)
      .upload(storagePath, new Uint8Array(buffer), {
        cacheControl: "3600",
        upsert: false,
      });

    if (error) {
      console.error("Storage upload error:", error);
      return NextResponse.json({ error: error.message || "Upload failed" }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = svc.storage
      .from(bucket)
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    return NextResponse.json({
      ok: true,
      url: publicUrl,
      fileName: fileName,
      fileSize: fileSize,
      storagePath: storagePath,
    });
  } catch (err) {
    console.error("Upload handler error:", err);
    return NextResponse.json({ error: err.message || "Upload failed" }, { status: 500 });
  }
}
