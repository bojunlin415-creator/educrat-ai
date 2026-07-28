import { describe, expect, it } from "vitest";

import {
  buildPrintableLayout,
  createCurriculumGenerationInput,
  createCurriculumPreview,
  createGeneratedCurriculum,
  createKnowledgePoint,
} from "@/lib/ai-curriculum";

const knowledgePoint = createKnowledgePoint({
  code: "MATH-FRACTION-001",
  competencyIndicator: "理解同分母分數的大小比較。",
  description: "能以圖像與數線比較同分母分數。",
  id: "kp-fraction-compare",
  title: "同分母分數比較",
});

describe("AI curriculum model", () => {
  it("creates immutable generation input and generated curriculum", () => {
    const input = createCurriculumGenerationInput({
      competencyIndicators: ["理解同分母分數的大小比較。"],
      curriculumTopic: "分數大小比較",
      difficulty: "MEDIUM",
      grade: 4,
      includeExplanations: true,
      knowledgePoints: [knowledgePoint],
      learningObjectives: ["學生能比較同分母分數大小。"],
      learningStage: "MIDDLE_ELEMENTARY",
      purpose: "課堂練習",
      questionCount: 2,
      subject: "數學",
      unit: "分數",
    });
    const curriculum = createGeneratedCurriculum({
      answers: ["1. 3/5 大於 2/5", "2. 因為分母相同，比較分子。"],
      challengeQuestions: [
        {
          answer: "4/7",
          answerSpaceLines: 4,
          difficulty: "MEDIUM",
          explanation: "分母相同時分子較大者較大。",
          id: "q-2",
          knowledgePointIds: [knowledgePoint.id],
          prompt: "請比較 4/7 與 3/7 的大小並說明理由。",
          type: "CHALLENGE",
        },
      ],
      examples: [
        {
          explanation: "同分母比較分子。",
          knowledgePointIds: [knowledgePoint.id],
          prompt: "比較 2/5 與 3/5。",
          solution: "3/5 較大。",
        },
      ],
      exercises: [
        {
          answer: "3/5",
          answerSpaceLines: 3,
          difficulty: "MEDIUM",
          explanation: "分子 3 大於 2。",
          id: "q-1",
          knowledgePointIds: [knowledgePoint.id],
          prompt: "2/5 和 3/5 哪一個比較大？",
          type: "EXERCISE",
        },
      ],
      summaryPoints: ["分母相同時，比較分子大小。"],
      teacherReminders: ["提醒學生用圖像確認分數大小。"],
      teachingGoals: ["學生能比較同分母分數大小。"],
      title: "四年級數學分數練習",
    });
    const layout = buildPrintableLayout(curriculum);
    const preview = createCurriculumPreview(curriculum, layout);

    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(curriculum)).toBe(true);
    expect(Object.isFrozen(curriculum.exercises[0]?.knowledgePointIds)).toBe(
      true,
    );
    expect(preview.sections.map((section) => section.title)).toContain(
      "練習題",
    );
    expect(layout.answerSpaces).toHaveLength(input.questionCount);
  });
});
