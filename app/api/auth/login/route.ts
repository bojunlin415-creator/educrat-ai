import { NextResponse } from "next/server";
import { authError, authSuccess, parseAuthJson } from "@/lib/auth/api";
import { resolvePostLoginDestination } from "@/lib/auth/destination";
import { getSafeAuthErrorMessage } from "@/lib/auth/errors";
import { checkAuthRateLimit } from "@/lib/auth/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";

export async function POST(request: Request) {
  const rateLimit = checkAuthRateLimit(request, "login");
  if (!rateLimit.allowed) {
    return NextResponse.json(authError("登入嘗試過於頻繁，請稍後再試。"), {
      status: 429,
      headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
    });
  }

  const parsed = await parseAuthJson(request, loginSchema);
  if (!parsed.success) return parsed.response;

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    if (error) {
      return NextResponse.json(authError(getSafeAuthErrorMessage(error)), {
        status: 401,
      });
    }

    return NextResponse.json(
      authSuccess("登入成功。", {
        redirectTo: await resolvePostLoginDestination(),
      }),
    );
  } catch {
    return NextResponse.json(authError("登入服務尚未設定或暫時無法使用。"), {
      status: 503,
    });
  }
}
