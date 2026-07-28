import { describe, expect, it } from "vitest";

import { decideRetry } from "@/lib/ai-generation";

describe("AI generation retry policy", () => {
  it("creates retry decisions without executing retries", () => {
    expect(
      decideRetry({
        attempt: 1,
        maxAttempts: 3,
        reason: "PROVIDER_TIMEOUT",
      }),
    ).toEqual({
      allowed: true,
      maxAttempts: 3,
      reason: "PROVIDER_TIMEOUT",
    });
    expect(
      decideRetry({
        attempt: 3,
        maxAttempts: 3,
        reason: "PROVIDER_TIMEOUT",
      }),
    ).toEqual({
      allowed: false,
      maxAttempts: 3,
      reason: "NON_RETRYABLE",
    });
  });
});
