import type { GeneratedCurriculum } from "@/lib/ai-curriculum/domain/curriculum";
import type { PrintableLayout } from "@/lib/ai-curriculum/domain/layout";
import { createPrintableLayout } from "@/lib/ai-curriculum/domain/layout";

export function buildPrintableLayout(
  curriculum: GeneratedCurriculum,
): PrintableLayout {
  const questions = [...curriculum.exercises, ...curriculum.challengeQuestions];
  return createPrintableLayout({
    answerSpaces: questions.map((question, index) => ({
      answerSpaceLines: question.answerSpaceLines,
      number: index + 1,
      questionId: question.id,
    })),
    exportTarget: "PDF",
    footer: "EduCraft AI｜原創教材｜教師審閱後使用",
    header: curriculum.title,
    numberedQuestions: true,
    pageSize: "A4",
    sectionOrder: [
      "標題",
      "教學目標",
      "重點整理",
      "範例",
      "練習題",
      "挑戰題",
      "解答",
      "教師提醒",
    ],
  });
}
