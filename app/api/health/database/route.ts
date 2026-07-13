import { NextResponse } from "next/server";
import { tryGetSupabasePublicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface DatabaseHealthResponse {
  service: "database";
  status: "ok" | "not_configured" | "unavailable";
}

export async function GET() {
  const env = tryGetSupabasePublicEnv();

  if (!env.configured) {
    return NextResponse.json<DatabaseHealthResponse>(
      { service: "database", status: "not_configured" },
      { status: 503 },
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("database_health");

    if (error || data !== true) {
      return NextResponse.json<DatabaseHealthResponse>(
        { service: "database", status: "unavailable" },
        { status: 503 },
      );
    }

    return NextResponse.json<DatabaseHealthResponse>({
      service: "database",
      status: "ok",
    });
  } catch {
    return NextResponse.json<DatabaseHealthResponse>(
      { service: "database", status: "unavailable" },
      { status: 503 },
    );
  }
}
