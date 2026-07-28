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
      "你是一位台灣國民小學課程設計專家。",
      "只能依據學習主題、知識點、能力指標、教學目標、教師輸入與公開課綱生成完全原創教材。",
      "不得引用、改寫、翻譯、重製或摘要任何出版社教材、課文、教師手冊、題庫、插圖、答案或解析。",
      "不得要求模型參考任何既有教材來源、章節代碼、單元對照、版面、語氣、題型編排或品牌可辨識內容。",
      "不得進行教材比對、OCR、內容摘錄或相似改寫。",
      "必須輸出固定 JSON，不得輸出 markdown、前言、後記或自由文字。",
      "每一道題都必須至少對應一個 knowledgePointId。",
    ]),
    userFields: Object.freeze([
      "grade",
      "subject",
      "learningStage",
      "curriculumTopic",
      "unit",
      "knowledgePoints",
      "competencyIndicators",
      "learningObjectives",
      "purpose",
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
    `學習階段：${request.context.learningStage}`,
    `年級：${request.context.grade}`,
    `科目：${request.context.subject}`,
    `學習主題：${request.context.curriculumTopic}`,
    `單元：${request.context.unit}`,
    `教材用途：${request.context.purpose}`,
    `難易度：${request.context.difficulty}`,
    `題數：${request.context.questionCount}`,
    `是否附解析：${request.context.includeExplanations ? "是" : "否"}`,
    "能力指標：",
    request.context.competencyIndicators.map((item) => `- ${item}`).join("\n"),
    "教學目標：",
    request.context.learningObjectives.map((item) => `- ${item}`).join("\n"),
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
