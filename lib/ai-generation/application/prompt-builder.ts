import type { GenerationRequest } from "@/lib/ai-generation/domain/model";
import type {
  AssembledPrompt,
  PromptTemplate,
} from "@/lib/ai-generation/domain/prompt";
import { createAssembledPrompt } from "@/lib/ai-generation/domain/prompt";

export const DEFAULT_CURRICULUM_PROMPT_TEMPLATE: PromptTemplate = Object.freeze(
  {
    systemRules: Object.freeze([
      "你是 EduCraft AI 的原創教材生成引擎。",
      "只能依據公開課綱、能力指標、教師輸入與知識點生成教材。",
      "不得直接引用、複製、改寫或重製出版社教材、課文、教師手冊、題庫、插圖、答案或解析。",
      "不得要求模型模仿任何出版社版面、語氣、題型編排或品牌可辨識內容。",
      "必須輸出固定 JSON，不得輸出 markdown、前言、後記或自由文字。",
      "每一道題都必須至少對應一個 knowledgePointId。",
    ]),
    userFields: Object.freeze([
      "grade",
      "subject",
      "curriculumReference",
      "unit",
      "knowledgePoints",
      "difficulty",
      "questionCount",
      "includeExplanations",
    ]),
    version: 1,
  },
);

export function buildSystemPrompt(template: PromptTemplate): string {
  return template.systemRules.join("\n");
}

export function buildUserPrompt(request: GenerationRequest): string {
  const knowledgePoints = request.context.knowledgePoints
    .map(
      (knowledgePoint) =>
        `- ${knowledgePoint.id}｜${knowledgePoint.title}｜${knowledgePoint.competencyIndicator}`,
    )
    .join("\n");

  return [
    `年級：${request.context.grade}`,
    `科目：${request.context.subject}`,
    `教材進度參考：${request.context.curriculumReference}`,
    `單元：${request.context.unit}`,
    `難易度：${request.context.difficulty}`,
    `題數：${request.context.questionCount}`,
    `是否附解析：${request.context.includeExplanations ? "是" : "否"}`,
    "知識點：",
    knowledgePoints,
    "請輸出 JSON 欄位：title, learningObjectives, summary, examples, questions, challengeQuestions, solutions, teacherNotes, knowledgePoints。",
  ].join("\n");
}

export function assemblePrompt(
  request: GenerationRequest,
  template: PromptTemplate = DEFAULT_CURRICULUM_PROMPT_TEMPLATE,
): AssembledPrompt {
  return createAssembledPrompt({
    messages: [
      { content: buildSystemPrompt(template), role: "system" },
      { content: buildUserPrompt(request), role: "user" },
    ],
    outputFormat: "json",
    templateVersion: template.version,
  });
}
