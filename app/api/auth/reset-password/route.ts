import { NextResponse } from "next/server";
import { authError, authSuccess, parseAuthJson } from "@/lib/auth/api";
import { getSafeAuthErrorMessage } from "@/lib/auth/errors";
import { checkAuthRateLimit } from "@/lib/auth/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const rateLimit = checkAuthRateLimit(request, "resetPassword");
  if (!rateLimit.allowed) {
    return NextResponse.json(authError("嘗試次數過多，請稍後再試。"), {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
  }

  const parsed = await parseAuthJson(request, resetPasswordSchema);
  if (!parsed.success) return parsed.response;

  try {
    const supabase = await createClient();
    const claims = await supabase.auth.getClaims();
    if (claims.error || !claims.data?.claims.sub) {
      return NextResponse.json(authError("重設連結已失效，請重新申請。"), {
        status: 401,
      });
    }

    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error) {
      return NextResponse.json(authError(getSafeAuthErrorMessage(error)), {
        status: 400,
      });
    }

    return NextResponse.json(
      authSuccess("密碼已更新，請使用新密碼登入。", {
        redirectTo: "/login?notice=password_updated",
      }),
    );
  } catch {
    return NextResponse.json(authError("密碼重設服務暫時無法使用。"), {
      status: 503,
    });
  }
}
