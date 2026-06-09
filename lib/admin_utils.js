import crypto from "crypto";

const ADMIN_SECRET = process.env.ADMIN_SECRET || "";

export function signToken(payloadObj) {
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString("base64url");
  const sig = crypto.createHmac("sha256", ADMIN_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyToken(token, maxAgeMs = 24 * 60 * 60 * 1000) {
  if (!token || !ADMIN_SECRET) return false;
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return false;
  const expect = crypto.createHmac("sha256", ADMIN_SECRET).update(payloadB64).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(sig))) return false;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    if (!payload.ts) return false;
    if (Date.now() - payload.ts > maxAgeMs) return false;
    return true;
  } catch (e) {
    return false;
  }
}

export function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return Object.fromEntries(cookieHeader.split(";").map(s=>s.trim().split("=")).map(([k,...v])=>[k,decodeURIComponent(v.join("=")||"")]));
}

export function getAdminTokenFromReq(req) {
  const cookie = req.headers.get("cookie") || "";
  const cookies = parseCookies(cookie);
  return cookies.admin_token || null;
}
