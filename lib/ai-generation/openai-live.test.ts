import { describe, expect, it } from "vitest";
import {
  createGenerationRequest,
  generateOriginalCurriculum,
} from "@/lib/ai-generation";
import { createOpenAIResponsesProvider } from "@/lib/ai-generation/infrastructure/openai-responses-provider";

const runLiveTests = process.env.RUN_OPENAI_LIVE_TESTS === "true";
const liveIt = runLiveTests ? it : it.skip;

describe("OpenAI live curriculum generation", () => {
  liveIt(
    "generates a copyright-safe structured curriculum draft with the configured provider",
    async () => {
      expect(process.env.OPENAI_API_KEY).toBeTruthy();

      const request = createGenerationRequest({
        context: {
          competencyIndicators: ["能理解三位數加減法並用估算檢查答案。"],
          curriculumTopic: "三位數加減法",
          difficulty: "EASY",
          grade: 3,
          includeExplanations: true,
          knowledgePoints: [
            {
              competencyIndicator: "能理解三位數加法。",
              id: "kp-1",
              title: "三位數加法",
            },
            {
              competencyIndicator: "能理解三位數減法。",
              id: "kp-2",
              title: "三位數減法",
            },
            {
              competencyIndicator: "能用估算與驗算檢查答案。",
              id: "kp-3",
              title: "估算與驗算",
            },
          ],
          learningObjectives: [
            "學生能完成三位數加法與減法。",
            "學生能使用估算與驗算檢查答案合理性。",
          ],
          learningStage: "國民小學",
          purpose: "課堂練習",
          questionCount: 5,
          subject: "數學",
          unit: "三位數加減法",
        },
        correlationId: "ai001-live-correlation",
        requestId: "ai001-live-request",
      });

      const result = await generateOriginalCurriculum(
        request,
        createOpenAIResponsesProvider(),
      );

      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.output.title).toContain("三位數");
      expect(
        result.output.questions.length +
          result.output.challengeQuestions.length,
      ).toBe(5);
      expect(result.output.knowledgePoints.length).toBeGreaterThanOrEqual(3);
      expect(result.metadata.provider).toBe("openai");
      expect(result.metadata.model).toBeTruthy();
      expect(result.metadata.usage.inputTokens).toBeGreaterThan(0);
      expect(result.metadata.usage.outputTokens).toBeGreaterThan(0);
    },
    60_000,
  );
});
