import { describe, expect, it } from "vitest";

import { validateCurriculumOutput } from "@/lib/ai-generation";
import type { GenerationContext } from "@/lib/ai-generation";

const context: GenerationContext = {
  competencyIndicators: ["能描述水的三態。"],
  curriculumTopic: "水的三態",
  difficulty: "EASY",
  grade: 3,
  includeExplanations: true,
  knowledgePoints: [
    {
      competencyIndicator: "能描述水的三態。",
      id: "kp-water",
      title: "水的三態",
    },
  ],
  learningObjectives: ["學生能辨認水的三態變化。"],
  learningStage: "MIDDLE_ELEMENTARY",
  purpose: "課堂練習",
  questionCount: 2,
  subject: "自然",
  unit: "水",
};

const validOutput = {
  challengeQuestions: [
    {
      answer: "凝結",
      difficulty: "EASY",
      explanation: "水蒸氣遇冷形成小水滴。",
      knowledgePointIds: ["kp-water"],
      prompt: "冰杯外側出現水珠是哪種現象？",
    },
  ],
  examples: [
    {
      explanation: "水受熱會蒸發。",
      knowledgePointIds: ["kp-water"],
      prompt: "水煮沸時會冒出水蒸氣。",
      solution: "液態水受熱變成氣態。",
    },
  ],
  knowledgePoints: [{ id: "kp-water", title: "水的三態" }],
  learningObjectives: ["能辨認水的三態變化。"],
  questions: [
    {
      answer: "氣態",
      difficulty: "EASY",
      explanation: "水蒸氣是水的氣態。",
      knowledgePointIds: ["kp-water"],
      prompt: "水蒸氣屬於哪一種狀態？",
    },
  ],
  solutions: ["氣態", "凝結"],
  summary: ["水有固態、液態與氣態。"],
  teacherNotes: ["避免學生把白煙誤認為氣態水本身。"],
  title: "水的三態練習",
};

describe("AI generation output validator", () => {
  it("accepts strict structured curriculum JSON", () => {
    const result = validateCurriculumOutput(context, validOutput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.isFrozen(result.output)).toBe(true);
      expect(result.output.title).toBe("水的三態練習");
    }
  });

  it("fails closed for free text or missing knowledge mapping", () => {
    expect(validateCurriculumOutput(context, "自由文字").success).toBe(false);
    expect(
      validateCurriculumOutput(context, {
        ...validOutput,
        questions: [
          {
            ...validOutput.questions[0],
            knowledgePointIds: ["unknown-kp"],
          },
        ],
      }),
    ).toEqual({ reason: "KNOWLEDGE_MAPPING_INVALID", success: false });
  });
});
