import { describe, expect, it } from "vitest";

import { assemblePrompt, createGenerationRequest } from "@/lib/ai-generation";

function createRequest() {
  return createGenerationRequest({
    context: {
      competencyIndicators: ["能理解同分母分數大小比較。"],
      curriculumTopic: "分數大小比較",
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
      learningObjectives: ["學生能比較同分母分數大小。"],
      learningStage: "MIDDLE_ELEMENTARY",
      purpose: "課堂練習",
      questionCount: 2,
      subject: "數學",
      unit: "分數",
    },
    correlationId: "corr-1",
    requestId: "req-1",
  });
}

describe("AI generation prompt pipeline", () => {
  it("assembles JSON-only prompts for original curriculum generation", () => {
    const prompt = assemblePrompt(createRequest());
    const serialized = JSON.stringify(prompt);

    expect(prompt.outputFormat).toBe("json");
    expect(serialized).toContain("固定 JSON");
    expect(serialized).toContain("完全原創教材");
    expect(serialized).toContain(
      "questions.length + challengeQuestions.length",
    );
    expect(serialized).toContain("合計總數");
    expect(serialized).toContain("kp-fraction");
    expect(serialized).toContain("學習主題：分數大小比較");
  });
});
