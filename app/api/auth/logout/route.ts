import { NextResponse } from "next/server";
import { getApplicationUrl } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  let appUrl: string;
  try {
    appUrl = getApplicationUrl();
  } catch {
    return NextResponse.json(
      { message: "登出服務尚未完成環境設定。" },
      { status: 503 },
    );
  }

  try {
    const supabase = await createClient();
    await supabase.auth.signOut();
  } catch {
    // Redirect safely even if configuration or the remote auth service is unavailable.
  }

  return NextResponse.redirect(`${appUrl}/login?notice=signed_out`, 303);
}
