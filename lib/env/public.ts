import { z } from "zod";

const supabasePublicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .trim()
    .url("NEXT_PUBLIC_SUPABASE_URL 必須是有效網址。"),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(20, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 格式不正確。"),
});

const applicationUrlSchema = z
  .string()
  .trim()
  .url("NEXT_PUBLIC_APP_URL 必須是有效網址。")
  .transform((url) => url.replace(/\/$/, ""));

export type SupabasePublicEnv = z.infer<typeof supabasePublicEnvSchema>;

export class SupabaseConfigurationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super("Supabase 環境變數尚未正確設定。");
    this.name = "SupabaseConfigurationError";
    this.issues = issues;
  }
}

export function parseSupabasePublicEnv(
  input: Record<string, string | undefined>,
): SupabasePublicEnv {
  const result = supabasePublicEnvSchema.safeParse(input);

  if (!result.success) {
    throw new SupabaseConfigurationError(
      result.error.issues.map((issue) => issue.message),
    );
  }

  return result.data;
}

export function getSupabasePublicEnv(): SupabasePublicEnv {
  return parseSupabasePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}

export function getApplicationUrl(): string {
  const result = applicationUrlSchema.safeParse(
    process.env.NEXT_PUBLIC_APP_URL,
  );

  if (!result.success) {
    throw new SupabaseConfigurationError(
      result.error.issues.map((issue) => issue.message),
    );
  }

  return result.data;
}

export function tryGetSupabasePublicEnv():
  | { configured: true; value: SupabasePublicEnv }
  | { configured: false; error: SupabaseConfigurationError } {
  try {
    return { configured: true, value: getSupabasePublicEnv() };
  } catch (error: unknown) {
    if (error instanceof SupabaseConfigurationError) {
      return { configured: false, error };
    }

    throw error;
  }
}
