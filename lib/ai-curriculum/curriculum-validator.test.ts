import { describe, expect, it } from "vitest";

import {
  buildPrintableLayout,
  createCurriculumGenerationInput,
  createGeneratedCurriculum,
  createKnowledgePoint,
  validateGeneratedCurriculum,
  validateGenerationInput,
} from "@/lib/ai-curriculum";

const knowledgePoint = createKnowledgePoint({
  code: "SCI-WATER-001",
  competencyIndicator: "認識水的三態變化。",
  description: "能說明水在加熱與冷卻時的狀態變化。",
  id: "kp-water-state",
  title: "水的三態",
});

function createValidInput() {
  return createCurriculumGenerationInput({
    competencyIndicators: ["認識水的三態變化。"],
    curriculumTopic: "水的三態",
    difficulty: "EASY",
    grade: 3,
    includeExplanations: true,
    knowledgePoints: [knowledgePoint],
    learningObjectives: ["學生能舉例說明水的三態變化。"],
    learningStage: "MIDDLE_ELEMENTARY",
    purpose: "課堂形成性評量",
    questionCount: 2,
    subject: "自然",
    unit: "水",
  });
}

function createValidCurriculum() {
  return createGeneratedCurriculum({
    answers: ["水蒸氣", "液態水"],
    challengeQuestions: [
      {
        answer: "凝結",
        answerSpaceLines: 4,
        difficulty: "EASY",
        explanation: "水蒸氣遇冷會凝結。",
        id: "q-2",
        knowledgePointIds: [knowledgePoint.id],
        prompt: "冷玻璃杯外出現水珠，和哪一種變化有關？",
        type: "CHALLENGE",
      },
    ],
    examples: [
      {
        explanation: "加熱會讓水變成水蒸氣。",
        knowledgePointIds: [knowledgePoint.id],
        prompt: "水煮沸後冒出的白霧與水蒸氣有關。",
        solution: "液態水受熱變為氣態。",
      },
    ],
    exercises: [
      {
        answer: "氣態",
        answerSpaceLines: 3,
        difficulty: "EASY",
        explanation: "水蒸氣是水的氣態。",
        id: "q-1",
        knowledgePointIds: [knowledgePoint.id],
        prompt: "水蒸氣屬於水的哪一種狀態？",
        type: "EXERCISE",
      },
    ],
    summaryPoints: ["水有固態、液態與氣態。"],
    teacherReminders: ["避免把白煙誤稱為真正看得見的水蒸氣。"],
    teachingGoals: ["學生能舉例說明水的三態變化。"],
    title: "三年級自然水的三態",
  });
}

describe("AI curriculum validator", () => {
  it("accepts complete input and generated curriculum", () => {
    const input = createValidInput();
    const curriculum = createValidCurriculum();
    const layout = buildPrintableLayout(curriculum);

    expect(validateGenerationInput(input)).toEqual({ issues: [], valid: true });
    expect(validateGeneratedCurriculum(input, curriculum, layout)).toEqual({
      issues: [],
      valid: true,
    });
  });

  it("rejects invalid input and unmapped questions", () => {
    const invalidInput = createCurriculumGenerationInput({
      competencyIndicators: [],
      curriculumTopic: "",
      difficulty: "MEDIUM",
      grade: 4,
      includeExplanations: false,
      knowledgePoints: [],
      learningObjectives: [],
      learningStage: "MIDDLE_ELEMENTARY",
      purpose: "",
      questionCount: 0,
      subject: "",
      unit: "",
    });
    const inputResult = validateGenerationInput(invalidInput);

    expect(inputResult.valid).toBe(false);
    expect(inputResult.issues.map((issue) => issue.code)).toContain(
      "INVALID_QUESTION_COUNT",
    );
    expect(inputResult.issues.map((issue) => issue.code)).toContain(
      "MISSING_KNOWLEDGE_MAPPING",
    );

    const validInput = createValidInput();
    const curriculum = createGeneratedCurriculum({
      ...createValidCurriculum(),
      exercises: [
        {
          answer: "氣態",
          answerSpaceLines: 3,
          difficulty: "EASY",
          id: "q-1",
          knowledgePointIds: [],
          prompt: "水蒸氣屬於水的哪一種狀態？",
          type: "EXERCISE",
        },
      ],
    });

    expect(
      validateGeneratedCurriculum(
        validInput,
        curriculum,
        buildPrintableLayout(curriculum),
      ).issues.map((issue) => issue.code),
    ).toContain("MISSING_KNOWLEDGE_MAPPING");
  });
});
