import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  try {
    const { userId } = await req.json();
    if (!userId) return Response.json({ error: "Missing userId" }, { status: 400 });

    // Disable 2FA
    await supabase
      .from("profiles")
      .update({
        two_fa_enabled: false,
        two_fa_secret: null,
        two_fa_secret_temp: null,
      })
      .eq("id", userId);

    return Response.json({ success: true });
  } catch (e) {
    console.error("2FA Disable Error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
