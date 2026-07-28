import { describe, expect, it } from "vitest";

import { serializeAiGenerationCanonical } from "@/lib/ai-generation";

describe("AI generation canonical serialization", () => {
  it("serializes equivalent objects deterministically", () => {
    const first = serializeAiGenerationCanonical({
      output: { b: 2, a: ["kp-1"] },
      metadata: { model: "m", provider: "p" },
    });
    const second = serializeAiGenerationCanonical({
      metadata: { provider: "p", model: "m" },
      output: { a: ["kp-1"], b: 2 },
    });

    expect(first).toBe(second);
  });
});
