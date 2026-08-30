import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api_auth";

// Per-account preferences: appearance, theme and language.
//
//   GET /api/prefs   (signed in) -> { prefs }
//   PUT /api/prefs   (signed in) -> { ok }
//
// The account id comes from the verified bearer token and never from the request
// body, so one user cannot read or overwrite another's. The browser keeps a local
// copy as a cache; this is the copy that follows the account between devices.

export const dynamic = "force-dynamic";

// Small on purpose: a handful of enum-ish strings, not a document store, on a
// row read by nearly every request.
const MAX_BYTES = 8_000;

export async function GET(req) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const { data, error } = await auth.svc
      .from("profiles").select("prefs").eq("id", auth.user.id).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ prefs: data?.prefs ?? null }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("prefs GET error:", err);
    // Never fail the page over preferences; the defaults are fine and the browser
    // still has its local copy. A missing `prefs` column (MIGRATION_PREFS.sql not
    // run) lands here.
    return NextResponse.json(
      { prefs: null, error: err.message || "Failed" }, { status: 200 });
  }
}

export async function PUT(req) {
  const auth = await requireUser(req);
  if (auth.response) return auth.response;

  try {
    const { prefs } = await req.json().catch(() => ({}));
    if (!prefs || typeof prefs !== "object" || Array.isArray(prefs)) {
      return NextResponse.json({ error: "Expected { prefs: {...} }" }, { status: 400 });
    }
    if (JSON.stringify(prefs).length > MAX_BYTES) {
      return NextResponse.json({ error: "Preferences are too large." }, { status: 413 });
    }

    // upsert, not update: an update against a missing profile row succeeds while
    // saving nothing. On conflict only `prefs` is written, never username/is_admin.
    const { error } = await auth.svc
      .from("profiles").upsert({ id: auth.user.id, prefs });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("prefs PUT error:", err);
    return NextResponse.json(
      { error: err.message || "Could not save preferences" }, { status: 500 });
  }
}
