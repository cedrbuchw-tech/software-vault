import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api_auth";
import { SECRET_HOWTO } from "@/lib/secret_answers";

// GET /api/admin/secrets  (admin only) → { howto: string[20] }
//
// The answer key for the secret hunt. It used to be a field on SECRET_LABELS in
// app/page.jsx, which is a client component — so the solutions to all twenty
// secrets shipped to every visitor inside the JavaScript bundle, whether or not
// the admin panel that displayed them was ever opened.
//
// Now the strings live in lib/secret_answers.js, which is imported by exactly
// one file: this one. Route handlers are server-only, so nothing here reaches
// the browser except through this endpoint, and this endpoint answers nobody
// who is not signed in as an admin.
//
// This is deliberately a separate route from /api/settings, which is public
// (the site needs the secret-download config to hand out rewards). Nothing on
// the public endpoint may ever describe how a secret is triggered.

export const dynamic = "force-dynamic";

export async function GET(req) {
  const auth = await requireAdmin(req);
  if (auth.response) return auth.response;

  return NextResponse.json({ howto: SECRET_HOWTO }, {
    // an answer key has no business in a CDN or a browser cache
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
