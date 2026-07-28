import { describe, expect, it } from "vitest";

import {
  buildCurriculumPrompt,
  createCurriculumGenerationInput,
  createKnowledgePoint,
} from "@/lib/ai-curriculum";

describe("AI curriculum prompt builder", () => {
  it("builds a structured prompt with originality rules and neutral reference display", () => {
    const prompt = buildCurriculumPrompt(
      createCurriculumGenerationInput({
        competencyIndicators: ["能辨識段落重點。"],
        curriculumTopic: "閱讀理解",
        difficulty: "HARD",
        grade: 4,
        includeExplanations: true,
        knowledgePoints: [
          createKnowledgePoint({
            code: "CHI-READ-001",
            competencyIndicator: "能辨識段落重點。",
            description: "閱讀後提取段落主要訊息。",
            id: "kp-reading-main-idea",
            title: "段落大意",
          }),
        ],
        learningObjectives: ["學生能提取段落主要訊息。"],
        learningStage: "MIDDLE_ELEMENTARY",
        purpose: "閱讀理解課堂練習",
        questionCount: 3,
        subject: "國語",
        unit: "閱讀理解",
      }),
    );
    const serializedPrompt = JSON.stringify(prompt);

    expect(serializedPrompt).toContain("原創教材");
    expect(serializedPrompt).toContain("完全原創教材");
    expect(serializedPrompt).toContain("學習主題：閱讀理解");
    expect(serializedPrompt).toContain("kp-reading-main-idea");
    expect(serializedPrompt).not.toContain("南一");
    expect(serializedPrompt).not.toContain("康軒");
    expect(serializedPrompt).not.toContain("翰林");
  });
});
