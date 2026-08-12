import "server-only";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import {
  authorizeCurriculumExport,
  isAllowedDecision,
} from "@/lib/curriculum/authorization";
import { writeCurriculumLifecycleAudit } from "@/lib/curriculum/audit";
import { CurriculumError } from "@/lib/curriculum/errors";
import {
  createCurriculumExportDocument,
  createSafeCurriculumExportFilename,
  isCurriculumExportMode,
  renderCurriculumExportPdf,
  type CurriculumExportDocument,
  type CurriculumExportMode,
  type CurriculumExportQuestionInput,
} from "@/lib/curriculum-export";
import { OrganizationError } from "@/lib/organization/errors";
import { requireOrganizationMembership } from "@/lib/organization/service";
import {
  requireSubjectCapability,
  resolveCanonicalSubjectId,
} from "@/lib/subjects";
import type { Database } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";
import { aiCurriculumGeneratedDraftSchema } from "@/lib/validation/ai-curriculum-generation";

type ChapterRow = Database["public"]["Tables"]["chapters"]["Row"];
type LessonRow = Database["public"]["Tables"]["lessons"]["Row"];

const uuidSchema = z.uuid();

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

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return new CurriculumError("service_unavailable");
  if (error.code === "42501") return new CurriculumError("forbidden");
  if (error.code === "P0002") return new CurriculumError("not_found");
  return new CurriculumError("service_unavailable");
}

async function requireExportContext() {
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

function modeToAuditValue(mode: CurriculumExportMode) {
  switch (mode) {
    case "worksheet":
      return "WORKSHEET";
    case "answer-sheet":
      return "ANSWER_SHEET";
    case "combined":
      return "COMBINED";
  }
}

function buildFallbackQuestions(
  lessons: readonly LessonRow[],
): readonly CurriculumExportQuestionInput[] {
  return Object.freeze(
    lessons.map((lesson) => ({
      answer: {
        explanation: lesson.teaching_notes ?? undefined,
        value: "請依教師課堂設計填入參考答案。",
      },
      knowledgePointIds: lesson.keywords,
      prompt: `${lesson.title}：請完成本課重點練習。`,
    })),
  );
}

function aiQuestions(content: unknown) {
  const parsed = aiCurriculumGeneratedDraftSchema.safeParse(content);
  if (!parsed.success) return null;
  return Object.freeze([
    ...parsed.data.questions.map<CurriculumExportQuestionInput>((question) => ({
      answer: {
        explanation: question.explanation,
        value: question.answer,
      },
      challenge: false,
      knowledgePointIds: question.knowledgePointIds,
      prompt: question.prompt,
    })),
    ...parsed.data.challengeQuestions.map<CurriculumExportQuestionInput>(
      (question) => ({
        answer: {
          explanation: question.explanation,
          value: question.answer,
        },
        challenge: true,
        knowledgePointIds: question.knowledgePointIds,
        prompt: question.prompt,
      }),
    ),
  ]);
}

function aiSections(content: unknown) {
  const parsed = aiCurriculumGeneratedDraftSchema.safeParse(content);
  if (!parsed.success) return [];
  return [
    {
      heading: "教學目標",
      items: parsed.data.learningObjectives,
      kind: "objectives" as const,
    },
    {
      heading: "重點整理",
      items: parsed.data.summary,
      kind: "summary" as const,
    },
    {
      heading: "範例",
      items: parsed.data.examples.map(
        (example) =>
          `${example.prompt}｜解法：${example.solution}｜說明：${example.explanation}`,
      ),
      kind: "examples" as const,
    },
    {
      heading: "教師提醒",
      items: parsed.data.teacherNotes,
      kind: "notes" as const,
    },
  ];
}

function hierarchySections(
  chapters: readonly ChapterRow[],
  lessons: readonly LessonRow[],
) {
  const objectives = lessons.flatMap((lesson) => lesson.learning_objectives);
  return [
    {
      heading: "教學目標",
      items:
        objectives.length > 0
          ? objectives
          : ["依已儲存教材版本與章節設計進行練習。"],
      kind: "objectives" as const,
    },
    {
      heading: "章節重點",
      items:
        chapters.length > 0
          ? chapters.map(
              (chapter) =>
                `${chapter.title}${chapter.description ? `：${chapter.description}` : ""}`,
            )
          : ["此版本尚未建立章節。"],
      kind: "summary" as const,
    },
  ];
}

export async function getCurriculumExportDocument(input: {
  readonly curriculumId: string;
  readonly mode: CurriculumExportMode;
  readonly versionId: string;
}): Promise<CurriculumExportDocument> {
  if (
    !uuidSchema.safeParse(input.curriculumId).success ||
    !uuidSchema.safeParse(input.versionId).success
  ) {
    throw new CurriculumError("not_found");
  }

  const { context, user } = await requireExportContext();
  const decision = await authorizeCurriculumExport({
    context,
    curriculumId: input.curriculumId,
    user,
  });
  if (!isAllowedDecision(decision)) throw new CurriculumError("forbidden");

  const supabase = await createClient();
  const { data: curriculum, error: curriculumError } = await supabase
    .from("curriculums")
    .select("*")
    .eq("id", input.curriculumId)
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (curriculumError) throw mapDatabaseError(curriculumError);
  if (!curriculum) throw new CurriculumError("not_found");

  const { data: version, error: versionError } = await supabase
    .from("curriculum_versions")
    .select("*")
    .eq("id", input.versionId)
    .eq("curriculum_id", curriculum.id)
    .maybeSingle();
  if (versionError) throw mapDatabaseError(versionError);
  if (!version) throw new CurriculumError("not_found");

  const [subjectResult, gradeResult, aiDraftResult, chaptersResult] =
    await Promise.all([
      supabase
        .from("subjects")
        .select("code,id,name")
        .eq("id", curriculum.subject_id)
        .single(),
      supabase
        .from("grades")
        .select("id,name")
        .eq("id", curriculum.grade_id)
        .single(),
      supabase
        .from("curriculum_ai_drafts")
        .select("content")
        .eq("organization_id", context.organization.id)
        .eq("curriculum_version_id", version.id)
        .maybeSingle(),
      supabase
        .from("chapters")
        .select("*")
        .eq("curriculum_version_id", version.id)
        .order("order_no", { ascending: true }),
    ]);
  if (subjectResult.error) throw mapDatabaseError(subjectResult.error);
  if (gradeResult.error) throw mapDatabaseError(gradeResult.error);
  if (aiDraftResult.error) throw mapDatabaseError(aiDraftResult.error);
  if (chaptersResult.error) throw mapDatabaseError(chaptersResult.error);
  requireSubjectCapability(
    resolveCanonicalSubjectId(subjectResult.data.code),
    "pdf_export",
  );

  const chapterIds = chaptersResult.data.map((chapter) => chapter.id);
  const lessonsResult =
    chapterIds.length > 0
      ? await supabase
          .from("lessons")
          .select("*")
          .in("chapter_id", chapterIds)
          .order("order_no", { ascending: true })
      : { data: [] as LessonRow[], error: null };
  if (lessonsResult.error) throw mapDatabaseError(lessonsResult.error);

  const draftContent = aiDraftResult.data?.content;
  const questions =
    draftContent === undefined
      ? buildFallbackQuestions(lessonsResult.data)
      : (aiQuestions(draftContent) ??
        buildFallbackQuestions(lessonsResult.data));
  const sections =
    draftContent === undefined
      ? hierarchySections(chaptersResult.data, lessonsResult.data)
      : aiSections(draftContent);
  const topic = chaptersResult.data[0]?.title ?? curriculum.name;

  return createCurriculumExportDocument({
    metadata: {
      curriculumId: curriculum.id,
      curriculumVersionId: version.id,
      grade: gradeResult.data.name,
      organizationName: context.organization.name,
      subject: subjectResult.data.name,
      title: curriculum.name,
      topic,
      version: version.version,
    },
    mode: input.mode,
    questions,
    sections,
  });
}

export async function exportCurriculumVersionPdf(input: {
  readonly curriculumId: string;
  readonly mode: string | null;
  readonly versionId: string;
}) {
  if (!isCurriculumExportMode(input.mode)) {
    throw new CurriculumError("invalid_export_mode");
  }
  const { context, user } = await requireExportContext();
  const document = await getCurriculumExportDocument({
    curriculumId: input.curriculumId,
    mode: input.mode,
    versionId: input.versionId,
  });
  const pdf = renderCurriculumExportPdf(document);
  const supabase = await createClient();
  await writeCurriculumLifecycleAudit({
    action: "CURRICULUM_EXPORTED",
    actingRole: context.membership.role,
    actorId: user.id,
    curriculumId: document.metadata.curriculumId,
    metadata: {
      curriculumId: document.metadata.curriculumId,
      curriculumVersionId: document.metadata.curriculumVersionId,
      exportMode: modeToAuditValue(document.mode),
      outputFormat: "PDF",
    },
    organizationId: context.organization.id,
    reason: "USER_REQUESTED_EXPORT",
    stateAfter: "UNCHANGED",
    stateBefore: "UNCHANGED",
    supabase,
  });

  return Object.freeze({
    data: pdf.data,
    filename: createSafeCurriculumExportFilename(document),
    mode: document.mode,
  });
}
