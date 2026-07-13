import "server-only";

import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { SupabaseConfigurationError } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";

export async function getCurrentUser(): Promise<User | null> {
  try {
    const supabase = await createClient();
    const claimsResult = await supabase.auth.getClaims();

    if (claimsResult.error || !claimsResult.data?.claims.sub) return null;

    const { data, error } = await supabase.auth.getUser();
    return error ? null : data.user;
  } catch (error: unknown) {
    if (error instanceof SupabaseConfigurationError) return null;
    throw error;
  }
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?notice=authentication_required");
  return user;
}
