import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientKey, tooMany } from "@/lib/api_auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  // public by necessity (used before sign-in), so throttle abuse:
  // mail bombing and username enumeration both start here.
  if (!rateLimit("reset:" + clientKey(req), 3, 300000)) return tooMany();
  try {
    const { email, redirectTo } = await req.json();
    if (!email) {
      return Response.json({ error: "Missing email" }, { status: 400 });
    }

    // always land on the page that can take a new password
    const base = String(redirectTo || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
      .replace(/\/+$/, "");
    const target = base.endsWith("/reset-password") ? base : `${base}/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: target,
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
