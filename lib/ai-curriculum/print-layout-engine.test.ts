import { describe, expect, it } from "vitest";

import {
  buildPrintableLayout,
  createGeneratedCurriculum,
} from "@/lib/ai-curriculum";

describe("AI curriculum print layout engine", () => {
  it("creates an A4 PDF-ready layout with numbering, header, footer, and answer spaces", () => {
    const curriculum = createGeneratedCurriculum({
      answers: ["A", "B"],
      challengeQuestions: [
        {
          answer: "B",
          answerSpaceLines: 5,
          difficulty: "HARD",
          id: "q-2",
          knowledgePointIds: ["kp-2"],
          prompt: "挑戰題",
          type: "CHALLENGE",
        },
      ],
      examples: [
        {
          explanation: "範例說明",
          knowledgePointIds: ["kp-1"],
          prompt: "範例",
          solution: "解法",
        },
      ],
      exercises: [
        {
          answer: "A",
          answerSpaceLines: 3,
          difficulty: "MEDIUM",
          id: "q-1",
          knowledgePointIds: ["kp-1"],
          prompt: "練習題",
          type: "EXERCISE",
        },
      ],
      summaryPoints: ["重點"],
      teacherReminders: ["提醒"],
      teachingGoals: ["目標"],
      title: "列印測試教材",
    });
    const layout = buildPrintableLayout(curriculum);

    expect(layout.pageSize).toBe("A4");
    expect(layout.exportTarget).toBe("PDF");
    expect(layout.numberedQuestions).toBe(true);
    expect(layout.header).toBe("列印測試教材");
    expect(layout.footer).toContain("EduCraft AI");
    expect(layout.answerSpaces).toEqual([
      { answerSpaceLines: 3, number: 1, questionId: "q-1" },
      { answerSpaceLines: 5, number: 2, questionId: "q-2" },
    ]);
  });
});
