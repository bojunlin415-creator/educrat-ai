import { NextResponse } from "next/server";
import { authError, authSuccess } from "@/lib/auth/api";
import { getSafeAuthErrorMessage } from "@/lib/auth/errors";
import { checkAuthRateLimit } from "@/lib/auth/rate-limit";
import { getApplicationUrl } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const rateLimit = checkAuthRateLimit(request, "oauth");
  if (!rateLimit.allowed) {
    return NextResponse.json(authError("登入嘗試過於頻繁，請稍後再試。"), {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
  }

  try {
    const supabase = await createClient();
    const appUrl = getApplicationUrl();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${appUrl}/auth/callback?next=/dashboard` },
    });

    if (error || !data.url) {
      return NextResponse.json(
        authError(
          error ? getSafeAuthErrorMessage(error) : "無法開始 Google 登入。",
        ),
        { status: 400 },
      );
    }

    return NextResponse.json(
      authSuccess("正在前往 Google 驗證。", {
        externalRedirectTo: data.url,
      }),
    );
  } catch {
    return NextResponse.json(authError("Google 登入尚未設定或暫時無法使用。"), {
      status: 503,
    });
  }
}
