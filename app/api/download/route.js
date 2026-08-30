import { NextResponse } from "next/server";

// GET /api/download?url=<storage url>&name=<filename>
//
// Streams a file from Supabase Storage with a download filename attached.
// VaultLaunch depends on two things here: Range requests are forwarded and the
// 206 passed back so a download resumes, and the body is streamed, never
// buffered, since builds run to hundreds of MB.

// The name goes into a response header; strip CR/LF and anything that could
// escape the quotes.
function safeName(name) {
  return String(name || "download").replace(/[\r\n"\\]/g, "_").slice(0, 200);
}

function isAllowed(rawUrl) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return false;
  try {
    const target = new URL(rawUrl);
    const allowed = new URL(base);
    return target.protocol === "https:" && target.hostname === allowed.hostname;
  } catch {
    return false;
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get("url");
    const fileName = safeName(searchParams.get("name"));

    if (!fileUrl) {
      return NextResponse.json({ error: "Missing file URL" }, { status: 400 });
    }

    // Only ever fetch from this project's own Supabase storage; without this
    // the route is an SSRF hole onto internal addresses.
    if (!isAllowed(fileUrl)) {
      return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
    }

    // pass the client's Range straight through to storage
    const range = req.headers.get("range");
    const upstream = await fetch(fileUrl, {
      headers: range ? { Range: range } : {},
      cache: "no-store",
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const headers = new Headers();
    headers.set("Content-Type", "application/octet-stream");
    headers.set("Content-Disposition", `attachment; filename="${fileName}"`);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "no-cache");
    // keep the bits a resuming client needs to verify its partial file
    for (const h of ["content-length", "content-range", "etag", "last-modified"]) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }

    // 206 stays 206 so the client knows its Range was honoured
    return new NextResponse(upstream.body, { status: upstream.status, headers });
  } catch (err) {
    console.error("Download proxy error:", err);
    return NextResponse.json({ error: err.message || "Download failed" }, { status: 500 });
  }
}
