import { describe, expect, it } from "vitest";

import { serializeCurriculumArtifact } from "@/lib/ai-curriculum";

describe("AI curriculum canonical serialization", () => {
  it("serializes equivalent objects deterministically", () => {
    const first = serializeCurriculumArtifact({
      b: 2,
      a: { y: true, x: ["kp-1", "kp-2"] },
    });
    const second = serializeCurriculumArtifact({
      a: { x: ["kp-1", "kp-2"], y: true },
      b: 2,
    });

    expect(first).toBe(second);
  });
});
