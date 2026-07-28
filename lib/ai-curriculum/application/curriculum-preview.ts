import type { GeneratedCurriculum } from "@/lib/ai-curriculum/domain/curriculum";
import type { PrintableLayout } from "@/lib/ai-curriculum/domain/layout";

export interface CurriculumPreviewSection {
  readonly content: readonly string[];
  readonly title: string;
}

export interface CurriculumPreview {
  readonly layout: PrintableLayout;
  readonly sections: readonly CurriculumPreviewSection[];
  readonly title: string;
}

export function createCurriculumPreview(
  curriculum: GeneratedCurriculum,
  layout: PrintableLayout,
): CurriculumPreview {
  return Object.freeze({
    layout,
    sections: Object.freeze([
      Object.freeze({
        content: Object.freeze([...curriculum.teachingGoals]),
        title: "教學目標",
      }),
      Object.freeze({
        content: Object.freeze([...curriculum.summaryPoints]),
        title: "重點整理",
      }),
      Object.freeze({
        content: Object.freeze(curriculum.exercises.map((item) => item.prompt)),
        title: "練習題",
      }),
      Object.freeze({
        content: Object.freeze(
          curriculum.challengeQuestions.map((item) => item.prompt),
        ),
        title: "挑戰題",
      }),
      Object.freeze({
        content: Object.freeze([...curriculum.teacherReminders]),
        title: "教師提醒",
      }),
    ]),
    title: curriculum.title,
  });
}
