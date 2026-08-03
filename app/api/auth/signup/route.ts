import { NextResponse } from "next/server";
import { authError, authSuccess, parseAuthJson } from "@/lib/auth/api";
import { resolvePostLoginDestination } from "@/lib/auth/destination";
import { getSafeAuthErrorMessage } from "@/lib/auth/errors";
import { checkAuthRateLimit } from "@/lib/auth/rate-limit";
import { getApplicationUrl } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";
import { signupSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const rateLimit = checkAuthRateLimit(request, "signup");
  if (!rateLimit.allowed) {
    return NextResponse.json(authError("註冊嘗試過於頻繁，請稍後再試。"), {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
  }

  const parsed = await parseAuthJson(request, signupSchema);
  if (!parsed.success) return parsed.response;

  try {
    const supabase = await createClient();
    const appUrl = getApplicationUrl();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard` },
    });

    if (error?.code === "user_already_exists") {
      return NextResponse.json(
        authSuccess("請前往信箱完成驗證；若帳號已存在，也不會另外揭露。"),
      );
    }

    if (error) {
      return NextResponse.json(authError(getSafeAuthErrorMessage(error)), {
        status: 400,
      });
    }

    return NextResponse.json(
      authSuccess(
        data.session
          ? "註冊完成，正在前往工作台。"
          : "請前往信箱完成驗證；若帳號已存在，也不會另外揭露。",
        data.session ? { redirectTo: await resolvePostLoginDestination() } : {},
      ),
    );
  } catch {
    return NextResponse.json(authError("註冊服務尚未設定或暫時無法使用。"), {
      status: 503,
    });
  }
}
