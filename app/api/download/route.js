import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get("url");
    const fileName = searchParams.get("name");

    if (!fileUrl) {
      return NextResponse.json({ error: "Missing file URL" }, { status: 400 });
    }

    // Fetch the file from Supabase Storage
    const response = await fetch(fileUrl);
    if (!response.ok) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const buffer = await response.arrayBuffer();

    // Return with download headers
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fileName || "download"}"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("Download proxy error:", err);
    return NextResponse.json({ error: err.message || "Download failed" }, { status: 500 });
  }
}
