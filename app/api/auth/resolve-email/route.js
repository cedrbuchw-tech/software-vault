import { createClient } from "@supabase/supabase-js";
import { rateLimit, clientKey, tooMany } from "@/lib/api_auth";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  // public by necessity (used before sign-in), so throttle abuse:
  // mail bombing and username enumeration both start here.
  if (!rateLimit("resolve:" + clientKey(req), 20, 60000)) return tooMany();
  try {
    const { username } = await req.json();
    if (!username) {
      return Response.json({ error: "Missing username" }, { status: 400 });
    }

    const { data, error } = await supabase.from("profiles").select("id").eq("username", username.trim()).single();
    if (error || !data) {
      return Response.json({ error: "Username not found" }, { status: 404 });
    }

    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(data.id);
    if (userError || !userData?.user?.email) {
      return Response.json({ error: "Unable to resolve email" }, { status: 404 });
    }

    return Response.json({ email: userData.user.email });
  } catch (e) {
    console.error("Resolve email error:", e);
    return Response.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
