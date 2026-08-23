// lib/download_target.js — decide how a download link should be opened.
//
// Every per-OS build is one of two very different things, and the old code
// treated them as one:
//
//   * a file uploaded to this project's Supabase Storage, which /api/download
//     proxies so the browser gets a real filename and resumable ranges;
//   * a link pasted into the admin panel — Google Drive, MEGA, a GitHub
//     release — which lives on someone else's server.
//
// Everything went through /api/download, and that route deliberately refuses
// any host other than Supabase (it would be a server-side request forgery hole
// otherwise). So a pasted link produced a 400 behind an <a download>, which a
// browser shows as absolutely nothing happening. Hence "I press download and
// nothing happens".
//
// Pasted links are opened directly instead. That is also the only thing that
// CAN work for MEGA: a MEGA file is encrypted in the browser and its key lives
// in the part of the URL after the '#', which is never sent to any server — no
// proxy on earth can fetch one for you.

/** Pull a file id out of any of the shapes a Drive link comes in. */
function driveFileId(u) {
  const byPath = u.pathname.match(/\/file\/d\/([^/]+)/)
              || u.pathname.match(/\/d\/([^/]+)/);
  if (byPath) return byPath[1];
  const byQuery = u.searchParams.get("id");
  return byQuery || null;
}

/**
 * @returns {{kind:"proxy"|"open"|"invalid", href:string, host:string}}
 *   proxy → same-origin /api/download link, safe to use with <a download>
 *   open  → hand straight to the browser in a new tab
 */
export function resolveDownload(rawUrl, { supabaseUrl, name } = {}) {
  let u;
  try {
    u = new URL(String(rawUrl || "").trim());
  } catch {
    return { kind: "invalid", href: "", host: "" };
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    return { kind: "invalid", href: "", host: "" };
  }

  const host = u.hostname.toLowerCase();

  // our own storage: proxy it, so the file arrives named and resumable
  let storageHost = "";
  try { storageHost = new URL(supabaseUrl).hostname.toLowerCase(); } catch { /* not configured */ }
  if (storageHost && host === storageHost) {
    return {
      kind: "proxy",
      host,
      href: `/api/download?url=${encodeURIComponent(u.href)}`
          + `&name=${encodeURIComponent(name || "download")}`,
    };
  }

  // Google Drive: a /file/d/<id>/view link is a viewer page, not a file. The
  // uc?export=download form is the one that actually starts a download —
  // though Drive still interrupts big files with its virus-scan notice, which
  // is Drive's behaviour and nothing this site can route around.
  if (host === "drive.google.com" || host === "docs.google.com") {
    const id = driveFileId(u);
    if (id) {
      return { kind: "open", host, href: `https://drive.google.com/uc?export=download&id=${id}` };
    }
    return { kind: "open", host, href: u.href };
  }

  // MEGA: hand over the link untouched, '#' fragment and all. Strip that and
  // the file becomes undecryptable.
  if (host === "mega.nz" || host === "mega.co.nz" || host.endsWith(".mega.nz")) {
    return { kind: "open", host, href: u.href };
  }

  return { kind: "open", host, href: u.href };
}

/** Nice label for "opening X in a new tab" messages. */
export function hostLabel(host) {
  if (!host) return "the download";
  if (host === "drive.google.com" || host === "docs.google.com") return "Google Drive";
  if (host === "mega.nz" || host === "mega.co.nz" || host.endsWith(".mega.nz")) return "MEGA";
  return host.replace(/^www\./, "");
}
