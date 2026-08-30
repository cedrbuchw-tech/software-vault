// Decide how a download link opens: our own Supabase Storage goes through
// /api/download, which rejects other hosts to avoid SSRF; anything else
// opens directly.

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

  // A Drive /file/d/<id>/view link is a viewer page; uc?export=download is the
  // form that actually downloads. Drive still gates large files behind its
  // virus-scan notice.
  if (host === "drive.google.com" || host === "docs.google.com") {
    const id = driveFileId(u);
    if (id) {
      return { kind: "open", host, href: `https://drive.google.com/uc?export=download&id=${id}` };
    }
    return { kind: "open", host, href: u.href };
  }

  // MEGA: the '#' fragment holds the decryption key, so pass the link untouched.
  if (host === "mega.nz" || host === "mega.co.nz" || host.endsWith(".mega.nz")) {
    return { kind: "open", host, href: u.href };
  }

  return { kind: "open", host, href: u.href };
}

/** Label for "opening X in a new tab" messages. */
export function hostLabel(host) {
  if (!host) return "the download";
  if (host === "drive.google.com" || host === "docs.google.com") return "Google Drive";
  if (host === "mega.nz" || host === "mega.co.nz" || host.endsWith(".mega.nz")) return "MEGA";
  return host.replace(/^www\./, "");
}
