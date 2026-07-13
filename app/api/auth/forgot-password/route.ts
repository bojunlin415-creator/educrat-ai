import { NextResponse } from "next/server";
import { authError, authSuccess, parseAuthJson } from "@/lib/auth/api";
import { getSafeAuthErrorMessage } from "@/lib/auth/errors";
import { checkAuthRateLimit } from "@/lib/auth/rate-limit";
import { getApplicationUrl } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const rateLimit = checkAuthRateLimit(request, "forgotPassword");
  if (!rateLimit.allowed) {
    return NextResponse.json(authError("申請次數過多，請稍後再試。"), {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
  }

  const parsed = await parseAuthJson(request, forgotPasswordSchema);
  if (!parsed.success) return parsed.response;

  try {
    const supabase = await createClient();
    const appUrl = getApplicationUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      { redirectTo: `${appUrl}/auth/callback?next=/reset-password` },
    );

    if (error && error.code?.includes("rate_limit")) {
      return NextResponse.json(authError(getSafeAuthErrorMessage(error)), {
        status: 429,
      });
    }

    return NextResponse.json(
      authSuccess("若此電子郵件已註冊，系統會寄出密碼重設信。"),
    );
  } catch {
    return NextResponse.json(
      authError("密碼重設服務尚未設定或暫時無法使用。"),
      {
        status: 503,
      },
    );
  }
}
