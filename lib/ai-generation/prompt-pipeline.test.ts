import { describe, expect, it } from "vitest";

import { assemblePrompt, createGenerationRequest } from "@/lib/ai-generation";

function createRequest() {
  return createGenerationRequest({
    context: {
      curriculumReference: "課綱通用版",
      difficulty: "MEDIUM",
      grade: 4,
      includeExplanations: true,
      knowledgePoints: [
        {
          competencyIndicator: "能理解同分母分數大小比較。",
          id: "kp-fraction",
          title: "同分母分數比較",
        },
      ],
      questionCount: 2,
      subject: "數學",
      unit: "分數",
    },
    correlationId: "corr-1",
    requestId: "req-1",
  });
}

describe("AI generation prompt pipeline", () => {
  it("assembles JSON-only copyright-safe prompts without publisher identity", () => {
    const prompt = assemblePrompt(createRequest());
    const serialized = JSON.stringify(prompt);

    expect(prompt.outputFormat).toBe("json");
    expect(serialized).toContain("固定 JSON");
    expect(serialized).toContain("不得直接引用");
    expect(serialized).toContain("kp-fraction");
    expect(serialized).not.toContain("南一");
    expect(serialized).not.toContain("康軒");
    expect(serialized).not.toContain("翰林");
  });
});
