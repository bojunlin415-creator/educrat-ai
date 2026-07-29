import "server-only";

import { randomUUID } from "node:crypto";
import {
  createGenerationRequest,
  generateOriginalCurriculum,
  validateCopyrightSafetyText,
  type CurriculumGenerationOutput,
  type GenerationResult,
} from "@/lib/ai-generation";
import { createOpenAIResponsesProvider } from "@/lib/ai-generation/infrastructure/openai-responses-provider";
import {
  authorizeAICurriculum,
  isAllowedDecision,
} from "@/lib/curriculum/authorization";
import { writeCurriculumLifecycleAudit } from "@/lib/curriculum/audit";
import { CurriculumError } from "@/lib/curriculum/errors";
import { getCurriculum } from "@/lib/curriculum/service";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  requireOrganizationMembership,
  type OrganizationContext,
} from "@/lib/organization/service";
import { OrganizationError } from "@/lib/organization/errors";
import {
  aiCurriculumGenerationRequestSchema,
  aiCurriculumSaveDraftSchema,
  type AICurriculumGenerationRequest,
  type AICurriculumSaveDraftInput,
} from "@/lib/validation/ai-curriculum-generation";

const DIFFICULTY_TO_LESSON_LEVEL = {
  EASY: 2,
  HARD: 5,
  MEDIUM: 3,
} as const;

type AIAction =
  "CURRICULUM_AI_EDITED" | "CURRICULUM_AI_GENERATED" | "CURRICULUM_AI_SAVED";

function mapOrganizationError(error: OrganizationError): CurriculumError {
  switch (error.code) {
    case "not_authenticated":
      return new CurriculumError("not_authenticated");
    case "organization_not_found":
    case "not_member":
      return new CurriculumError("organization_required");
    case "forbidden":
      return new CurriculumError("forbidden");
    default:
      return new CurriculumError("service_unavailable");
  }
}

async function requireAICurriculumContext(): Promise<{
  readonly context: OrganizationContext;
  readonly user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
}> {
  const user = await getCurrentUser();
  if (!user) throw new CurriculumError("not_authenticated");
  try {
    return {
      context: await requireOrganizationMembership(),
      user,
    };
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

async function authorizeAI(input: {
  readonly context: OrganizationContext;
  readonly permission: "curriculum.create" | "curriculum.generate";
  readonly user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
}) {
  const decision = await authorizeAICurriculum(input);
  if (!isAllowedDecision(decision)) throw new CurriculumError("forbidden");
}

function ensureCopyrightSafe(input: unknown) {
  const result = validateCopyrightSafetyText(JSON.stringify(input));
  if (!result.safe) throw new CurriculumError("copyright_blocked");
}

function generationRequestFromInput(input: AICurriculumGenerationRequest) {
  const knowledgePoints = input.knowledgePoints.map((title, index) => ({
    competencyIndicator:
      input.competencyIndicators[index] ??
      input.competencyIndicators[0] ??
      "GENERAL",
    id: `kp-${index + 1}`,
    title,
  }));

  return createGenerationRequest({
    context: {
      competencyIndicators: input.competencyIndicators,
      curriculumTopic: input.curriculumTopic,
      difficulty: input.difficulty,
      grade: input.grade,
      includeExplanations: true,
      knowledgePoints,
      learningObjectives: input.learningObjectives,
      learningStage: input.learningStage,
      purpose: `${input.purpose}；輸出語言：${input.language}`,
      questionCount: input.questionCount,
      subject: input.subject,
      unit: input.curriculumTopic,
    },
    correlationId: `ai001:${randomUUID()}`,
    requestId: `ai001:${randomUUID()}`,
  });
}

function mapGenerationFailure(
  result: Exclude<
    GenerationResult<CurriculumGenerationOutput>,
    { success: true }
  >,
) {
  switch (result.error.code) {
    case "INVALID_REQUEST":
    case "PROMPT_BUILD_FAILED":
    case "KNOWLEDGE_MAPPING_INVALID":
    case "STRUCTURED_OUTPUT_INVALID":
      return new CurriculumError("invalid_ai_generation");
    case "PROVIDER_UNAVAILABLE":
      return new CurriculumError("ai_provider_unavailable");
    default:
      return new CurriculumError("ai_generation_failed");
  }
}

export async function generateAICurriculumDraft(
  input: AICurriculumGenerationRequest,
) {
  const parsed = aiCurriculumGenerationRequestSchema.safeParse(input);
  if (!parsed.success) throw new CurriculumError("invalid_input");
  ensureCopyrightSafe(parsed.data);

  const { context, user } = await requireAICurriculumContext();
  await authorizeAI({ context, permission: "curriculum.generate", user });

  const request = generationRequestFromInput(parsed.data);
  const result = await generateOriginalCurriculum(
    request,
    createOpenAIResponsesProvider(),
  );
  if (!result.success) throw mapGenerationFailure(result);

  ensureCopyrightSafe(result.output);
  return Object.freeze({
    draft: result.output,
    metadata: result.metadata,
  });
}

function toJson(output: CurriculumGenerationOutput): Json {
  return JSON.parse(JSON.stringify(output)) as Json;
}

function formatTeachingNotes(output: CurriculumGenerationOutput): string {
  const lines = [
    "AI 原創教材草稿摘要",
    "",
    "重點整理：",
    ...output.summary.map((item) => `- ${item}`),
    "",
    "範例：",
    ...output.examples.map(
      (item, index) =>
        `${index + 1}. ${item.prompt}｜${item.solution}｜${item.explanation}`,
    ),
    "",
    "練習題：",
    ...output.questions.map(
      (item, index) =>
        `${index + 1}. ${item.prompt}｜答案：${item.answer}｜解析：${
          item.explanation ?? "無"
        }`,
    ),
    "",
    "挑戰題：",
    ...output.challengeQuestions.map(
      (item, index) =>
        `${index + 1}. ${item.prompt}｜答案：${item.answer}｜解析：${
          item.explanation ?? "無"
        }`,
    ),
    "",
    "教師提醒：",
    ...output.teacherNotes.map((item) => `- ${item}`),
  ];
  return lines.join("\n").slice(0, 5000);
}

function hasTeacherEdits(input: AICurriculumSaveDraftInput): boolean {
  if (!input.originalDraft) return true;
  return (
    JSON.stringify(input.originalDraft) !== JSON.stringify(input.generatedDraft)
  );
}

function rpcResultId(data: Json, key: string): string {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    throw new CurriculumError("service_unavailable");
  }
  const value = data[key];
  if (typeof value !== "string")
    throw new CurriculumError("service_unavailable");
  return value;
}

async function writeAIAudit(input: {
  readonly action: AIAction;
  readonly context: OrganizationContext;
  readonly curriculumId: string;
  readonly reason: string;
  readonly userId: string;
  readonly versionId: string;
}) {
  const supabase = await createClient();
  return writeCurriculumLifecycleAudit({
    action: input.action,
    actingRole: input.context.membership.role,
    actorId: input.userId,
    curriculumId: input.curriculumId,
    metadata: {
      curriculumVersionId: input.versionId,
    },
    organizationId: input.context.organization.id,
    reason: input.reason,
    stateAfter: "DRAFT",
    stateBefore: "NONE",
    supabase,
  });
}

export async function saveAICurriculumDraft(input: AICurriculumSaveDraftInput) {
  const parsed = aiCurriculumSaveDraftSchema.safeParse(input);
  if (!parsed.success) throw new CurriculumError("invalid_input");
  ensureCopyrightSafe(parsed.data.request);
  ensureCopyrightSafe(parsed.data.generatedDraft);

  const { context, user } = await requireAICurriculumContext();
  await authorizeAI({ context, permission: "curriculum.create", user });

  const edited = hasTeacherEdits(parsed.data);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "create_ai_generated_curriculum_draft",
    {
      p_chapter_description: parsed.data.generatedDraft.summary.join("\n"),
      p_chapter_title: parsed.data.request.curriculumTopic,
      p_client_request_id: parsed.data.clientRequestId,
      p_content: toJson(parsed.data.generatedDraft),
      p_difficulty: DIFFICULTY_TO_LESSON_LEVEL[parsed.data.request.difficulty],
      p_edited: edited,
      p_grade_id: parsed.data.gradeId,
      p_keywords: parsed.data.generatedDraft.knowledgePoints.map(
        (item) => item.title,
      ),
      p_learning_objectives: parsed.data.generatedDraft.learningObjectives,
      p_lesson_title: parsed.data.generatedDraft.title,
      p_name: parsed.data.generatedDraft.title,
      p_publisher_id: parsed.data.curriculumReferenceId,
      p_school_year: parsed.data.schoolYear,
      p_semester: parsed.data.semester,
      p_subject_id: parsed.data.subjectId,
      p_teaching_notes: formatTeachingNotes(parsed.data.generatedDraft),
      p_version_remark: `AI-001 原創教材草稿｜${parsed.data.request.curriculumTopic}`,
    },
  );
  if (error) {
    if (error.message?.includes("curriculum_name_taken")) {
      throw new CurriculumError("duplicate_name");
    }
    if (error.code === "42501") throw new CurriculumError("forbidden");
    if (error.code === "22023") throw new CurriculumError("invalid_input");
    throw new CurriculumError("service_unavailable");
  }

  const curriculumId = rpcResultId(data as Json, "curriculumId");
  const versionId = rpcResultId(data as Json, "versionId");
  await writeAIAudit({
    action: "CURRICULUM_AI_GENERATED",
    context,
    curriculumId,
    reason: "AI_GENERATION_REQUESTED",
    userId: user.id,
    versionId,
  });
  if (edited) {
    await writeAIAudit({
      action: "CURRICULUM_AI_EDITED",
      context,
      curriculumId,
      reason: "TEACHER_REVIEWED_AND_EDITED",
      userId: user.id,
      versionId,
    });
  }
  await writeAIAudit({
    action: "CURRICULUM_AI_SAVED",
    context,
    curriculumId,
    reason: "AI_DRAFT_SAVED",
    userId: user.id,
    versionId,
  });

  return getCurriculum(curriculumId);
}

export async function getAICurriculumDraft(curriculumId: string) {
  const { context } = await requireAICurriculumContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("curriculum_ai_drafts")
    .select("*")
    .eq("organization_id", context.organization.id)
    .eq("curriculum_id", curriculumId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new CurriculumError("service_unavailable");
  return data;
}
