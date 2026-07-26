import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  try {
    const { email, redirectTo } = await req.json();
    if (!email) {
      return Response.json({ error: "Missing email" }, { status: 400 });
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}`,
    });

    if (error) {
      // Don't leak if email exists or not
      return Response.json({ success: true });
    }

    return Response.json({ success: true });
  } catch (e) {
    console.error("Password Reset Error:", e);
    return Response.json({ success: true }); // Don't leak errors
  }
}
