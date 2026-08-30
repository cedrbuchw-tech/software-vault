import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api_auth";
import { SECRET_HOWTO } from "@/lib/secret_answers";

// GET /api/admin/secrets  (admin only) -> { howto: string[20] }
//
// The answer key for the secret hunt. lib/secret_answers.js is imported here and
// nowhere else, so the answers never reach the client bundle. Keep them out of
// the public /api/settings: nothing there may describe how a secret is triggered.

export const dynamic = "force-dynamic";

export async function GET(req) {
  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;

  return NextResponse.json({ howto: SECRET_HOWTO }, {
    // never cache an answer key in a CDN or a browser
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
