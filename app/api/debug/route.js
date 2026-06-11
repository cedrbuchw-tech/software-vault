import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/vault_client";

export async function GET(req) {
  const SUPABASE_ENABLED = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_ENABLED) {
    return NextResponse.json({
      error: "Supabase not configured",
      supabaseEnabled: false
    });
  }

  try {
    const svc = getServiceClient();

    // Test connection
    const { data, error } = await svc.from("programs").select("*").limit(1);

    if (error) {
      return NextResponse.json({
        error: error.message,
        errorCode: error.code,
        tableExists: false,
      }, { status: 500 });
    }

    // Get count
    const { count, error: countErr } = await svc.from("programs").select("*", { count: "exact", head: true });

    if (countErr) {
      return NextResponse.json({
        error: countErr.message,
        tableExists: false,
      }, { status: 500 });
    }

    return NextResponse.json({
      status: "ok",
      tableExists: true,
      programsInDatabase: count || 0,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
  } catch (err) {
    return NextResponse.json({
      error: err.message,
      status: "error",
    }, { status: 500 });
  }
}
