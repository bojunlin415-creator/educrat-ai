import { NextResponse } from "next/server";
import { resolvePostLoginDestination } from "@/lib/auth/destination";
import { getApplicationUrl } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";
import { authCallbackSchema } from "@/lib/validation/auth";

export async function GET(request: Request) {
  let appUrl: string;
  try {
    appUrl = getApplicationUrl();
  } catch {
    return NextResponse.json(
      { message: "驗證服務尚未完成環境設定。" },
      { status: 503 },
    );
  }

  const url = new URL(request.url);
  const parsed = authCallbackSchema.safeParse({
    code: url.searchParams.get("code"),
    next: url.searchParams.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.redirect(`${appUrl}/login?error=invalid_callback`, 303);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(
      parsed.data.code,
    );
    if (!error) {
      const destination =
        parsed.data.next === "/dashboard"
          ? await resolvePostLoginDestination()
          : parsed.data.next;
      return NextResponse.redirect(`${appUrl}${destination}`, 303);
    }
  } catch {
    // Fall through to a user-safe error redirect.
  }

  return NextResponse.redirect(`${appUrl}/login?error=callback_failed`, 303);
}
