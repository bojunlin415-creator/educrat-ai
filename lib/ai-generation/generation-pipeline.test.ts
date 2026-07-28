import { describe, expect, it } from "vitest";

import {
  createGenerationRequest,
  generateCurriculum,
  type AIProvider,
} from "@/lib/ai-generation";

function createRequest() {
  return createGenerationRequest({
    context: {
      curriculumReference: "課綱通用版",
      difficulty: "MEDIUM",
      grade: 5,
      includeExplanations: true,
      knowledgePoints: [
        {
          competencyIndicator: "能理解小數乘法的意義。",
          id: "kp-decimal",
          title: "小數乘法",
        },
      ],
      questionCount: 1,
      subject: "數學",
      unit: "小數乘法",
    },
    correlationId: "corr-generate-1",
    requestId: "req-generate-1",
  });
}

function createProvider(rawOutput: unknown): AIProvider {
  return {
    generate: async () => ({
      rawOutput,
      usage: {
        estimatedCost: 0.01,
        inputTokens: 120,
        latencyMs: 250,
        model: "mock-model",
        outputTokens: 300,
        provider: "mock-provider",
      },
    }),
    health: async () => ({ status: "AVAILABLE" }),
    modelName: () => "mock-model",
    providerName: () => "mock-provider",
  };
}

describe("AI generation pipeline", () => {
  it("runs input validation, prompt build, provider call, structured validation, and result mapping", async () => {
    const result = await generateCurriculum(
      createRequest(),
      createProvider({
        challengeQuestions: [],
        examples: [
          {
            explanation: "0.2 乘以 3 表示三個 0.2。",
            knowledgePointIds: ["kp-decimal"],
            prompt: "0.2 × 3 可以怎麼想？",
            solution: "0.2 + 0.2 + 0.2 = 0.6",
          },
        ],
        knowledgePoints: [{ id: "kp-decimal", title: "小數乘法" }],
        learningObjectives: ["能用加法意義理解小數乘法。"],
        questions: [
          {
            answer: "0.6",
            difficulty: "MEDIUM",
            explanation: "三個 0.2 是 0.6。",
            knowledgePointIds: ["kp-decimal"],
            prompt: "0.2 × 3 = ?",
          },
        ],
        solutions: ["0.6"],
        summary: ["小數乘法可用重複加法理解。"],
        teacherNotes: ["提醒學生對齊位值。"],
        title: "小數乘法練習",
      }),
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.output.title).toBe("小數乘法練習");
      expect(result.metadata.usage.inputTokens).toBe(120);
    }
  });

  it("fails closed for invalid request and unavailable provider", async () => {
    const invalidRequest = createGenerationRequest({
      ...createRequest(),
      context: {
        ...createRequest().context,
        questionCount: 0,
      },
    });
    expect(
      await generateCurriculum(invalidRequest, createProvider({})),
    ).toMatchObject({
      error: { code: "INVALID_REQUEST" },
      success: false,
    });

    const unavailableProvider: AIProvider = {
      ...createProvider({}),
      health: async () => ({ status: "UNAVAILABLE" }),
    };
    expect(
      await generateCurriculum(createRequest(), unavailableProvider),
    ).toMatchObject({
      error: { code: "PROVIDER_UNAVAILABLE" },
      success: false,
    });
  });
});
