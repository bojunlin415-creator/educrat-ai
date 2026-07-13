import { parseSupabasePublicEnv, SupabaseConfigurationError } from "./public";

describe("Supabase public environment", () => {
  it("accepts a valid URL and publishable key", () => {
    expect(
      parseSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
          "sb_publishable_example_key_for_tests",
      }),
    ).toEqual({
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        "sb_publishable_example_key_for_tests",
    });
  });

  it("rejects missing or malformed values without echoing secrets", () => {
    expect(() =>
      parseSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "short",
      }),
    ).toThrow(SupabaseConfigurationError);

    try {
      parseSupabasePublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: "not-a-url",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "short",
      });
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(SupabaseConfigurationError);
      expect(String(error)).not.toContain("short");
    }
  });
});
