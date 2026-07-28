import type { CurriculumGenerationInput } from "@/lib/ai-curriculum/domain/input";

export interface CurriculumTemplateSection {
  readonly required: boolean;
  readonly title: string;
}

export interface CurriculumTemplate {
  readonly sections: readonly CurriculumTemplateSection[];
  readonly title: string;
  readonly version: number;
}

const REQUIRED_SECTIONS: readonly CurriculumTemplateSection[] = Object.freeze([
  Object.freeze({ required: true, title: "標題" }),
  Object.freeze({ required: true, title: "教學目標" }),
  Object.freeze({ required: true, title: "重點整理" }),
  Object.freeze({ required: true, title: "範例" }),
  Object.freeze({ required: true, title: "練習題" }),
  Object.freeze({ required: true, title: "挑戰題" }),
  Object.freeze({ required: true, title: "解答" }),
  Object.freeze({ required: true, title: "教師提醒" }),
]);

export function createCurriculumTemplate(
  input: CurriculumGenerationInput,
): CurriculumTemplate {
  return Object.freeze({
    sections: REQUIRED_SECTIONS,
    title: `${input.grade}年級 ${input.subject}｜${input.curriculumTopic}`,
    version: input.version,
  });
}
