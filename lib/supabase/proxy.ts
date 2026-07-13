import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { tryGetSupabasePublicEnv } from "@/lib/env/public";
import type { Database } from "@/lib/supabase/database.types";

export async function updateSession(request: NextRequest) {
  const envResult = tryGetSupabasePublicEnv();
  const isProtectedRoute =
    request.nextUrl.pathname === "/dashboard" ||
    request.nextUrl.pathname.startsWith("/dashboard/") ||
    request.nextUrl.pathname === "/reset-password";
  const isPublicAuthRoute = ["/login", "/signup"].includes(
    request.nextUrl.pathname,
  );

  if (!envResult.configured) {
    if (isProtectedRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "?notice=authentication_required";
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    envResult.value.NEXT_PUBLIC_SUPABASE_URL,
    envResult.value.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, options, value }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // getClaims validates the JWT; getSession must not be trusted for authorization.
  const { data, error } = await supabase.auth.getClaims();
  const authenticated = !error && Boolean(data?.claims.sub);

  if (isProtectedRoute && !authenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "?notice=authentication_required";
    const redirectResponse = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  if (isPublicAuthRoute && authenticated) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    dashboardUrl.search = "";
    const redirectResponse = NextResponse.redirect(dashboardUrl);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    return redirectResponse;
  }

  return response;
}
