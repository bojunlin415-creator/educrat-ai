import type { CurriculumGenerationInput } from "@/lib/ai-curriculum/domain/input";
import type { CurriculumPrompt } from "@/lib/ai-curriculum/domain/prompt";
import { createCurriculumPrompt } from "@/lib/ai-curriculum/domain/prompt";
import { toNeutralCurriculumReferenceLabel } from "@/lib/ai-curriculum/application/curriculum-reference";

const ORIGINALITY_RULES = Object.freeze([
  "只依據公開課綱、能力指標與知識點生成原創教材。",
  "不得複製、改寫、引用或重製任何出版社課文、教師手冊、題庫、插圖、答案或解析。",
  "不得使用 OCR、逐字摘錄、版面仿製或品牌可辨識內容。",
  "每一道題都必須標示至少一個知識點 ID。",
  "輸出必須是可驗證的結構化教材，不可加入未請求的商業流程。",
] as const);

export function buildCurriculumPrompt(
  input: CurriculumGenerationInput,
): CurriculumPrompt {
  const referenceLabel = toNeutralCurriculumReferenceLabel(
    input.legacyPublisherReference,
  );
  const knowledgePointLines = input.knowledgePoints
    .map(
      (knowledgePoint) =>
        `- ${knowledgePoint.id}｜${knowledgePoint.title}｜${knowledgePoint.competencyIndicator}`,
    )
    .join("\n");

  return createCurriculumPrompt({
    messages: [
      {
        content: [
          "你是 EduCraft AI 的原創教材設計助手。",
          ...ORIGINALITY_RULES,
          "請以台灣國小教師可審閱的繁體中文生成內容。",
        ].join("\n"),
        role: "system",
      },
      {
        content: [
          `年級：${input.grade} 年級`,
          `科目：${input.subject}`,
          `教材進度參考：${referenceLabel}`,
          `冊次：${input.book}`,
          `單元：${input.unit}`,
          `難易度：${input.difficulty}`,
          `題數：${input.questionCount}`,
          `是否附解析：${input.includeExplanations ? "是" : "否"}`,
          "知識點：",
          knowledgePointLines,
          "教材結構必須包含：標題、教學目標、重點整理、範例、練習題、挑戰題、解答、教師提醒。",
        ].join("\n"),
        role: "user",
      },
    ],
    safetyRules: ORIGINALITY_RULES,
    version: input.version,
  });
}
