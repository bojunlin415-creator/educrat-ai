import { describe, expect, it } from "vitest";

import {
  assemblePrompt,
  createGenerationRequest,
  validateCopyrightSafetyText,
  validatePromptCopyrightSafety,
} from "@/lib/ai-generation";

function createRequestWithTopic(curriculumTopic: string) {
  return createGenerationRequest({
    context: {
      competencyIndicators: ["能理解角的大小。"],
      curriculumTopic,
      difficulty: "MEDIUM",
      grade: 4,
      includeExplanations: true,
      knowledgePoints: [
        {
          competencyIndicator: "能辨識角並比較角的大小。",
          id: "kp-angle",
          title: "角的大小",
        },
      ],
      learningObjectives: ["學生能辨識角並比較角的大小。"],
      learningStage: "MIDDLE_ELEMENTARY",
      purpose: "課堂練習",
      questionCount: 1,
      subject: "數學",
      unit: "角",
    },
    correlationId: "corr-copyright-1",
    requestId: "req-copyright-1",
  });
}

describe("Copyright safety validation", () => {
  it("allows original curriculum topics without source identity", () => {
    const prompt = assemblePrompt(createRequestWithTopic("角的大小"));

    expect(validatePromptCopyrightSafety(prompt)).toEqual({
      blockedTerms: [],
      safe: true,
    });
  });

  it("detects forbidden source vocabulary and fails closed", () => {
    const prompt = assemblePrompt(createRequestWithTopic("康軒角的單元"));
    const result = validatePromptCopyrightSafety(prompt);

    expect(result.safe).toBe(false);
    expect(result.blockedTerms).toContain("康軒");
    expect(validateCopyrightSafetyText("請參考教師手冊和題庫")).toEqual({
      blockedTerms: ["教師手冊", "題庫"],
      safe: false,
    });
  });
});
