import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const svc = getServiceClient();
    const bucket = "programs";
    const fileName = formData.get("fileName") || file.name;
    const fileSize = file.size;

    // Create unique path: timestamp-originalname
    const timestamp = Date.now();
    const ext = fileName.split(".").pop();
    const baseName = fileName.replace(`.${ext}`, "");
    const storagePath = `${timestamp}-${baseName}.${ext}`;

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
