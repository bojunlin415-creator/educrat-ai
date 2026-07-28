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
        book: "第 7 冊",
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
        legacyPublisherReference: "NAN_YI",
        questionCount: 3,
        subject: "國語",
        unit: "閱讀理解",
      }),
    );
    const serializedPrompt = JSON.stringify(prompt);

    expect(serializedPrompt).toContain("原創教材");
    expect(serializedPrompt).toContain("不得複製");
    expect(serializedPrompt).toContain("教學進度模板 1");
    expect(serializedPrompt).toContain("kp-reading-main-idea");
    expect(serializedPrompt).not.toContain("南一");
    expect(serializedPrompt).not.toContain("康軒");
    expect(serializedPrompt).not.toContain("翰林");
  });
});
