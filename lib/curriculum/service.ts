import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { getCurrentUser } from "@/lib/auth/session";
import {
  authorizeCurriculumLifecycle,
  isAllowedDecision,
} from "@/lib/curriculum/authorization";
import { writeCurriculumLifecycleAudit } from "@/lib/curriculum/audit";
import { CurriculumError } from "@/lib/curriculum/errors";
import {
  curriculumToRecycleEntry,
  evaluateCurriculumPermanentDeletion,
  evaluateCurriculumRestore,
} from "@/lib/curriculum/recycle-bin";
import {
  toCurriculumReferenceDisplay,
  type CurriculumReferenceDisplay,
} from "@/lib/curriculum/reference-display";
import {
  requireOrganizationMembership,
  requireOrganizationRole,
} from "@/lib/organization/service";
import { OrganizationError } from "@/lib/organization/errors";
import type { OrganizationRole } from "@/lib/organization/constants";
import { createClient } from "@/lib/supabase/server";
import {
  createChapterSchema,
  createLessonSchema,
  deleteChapterSchema,
  deleteLessonSchema,
  reorderChaptersSchema,
  reorderLessonsSchema,
  updateChapterSchema,
  updateLessonSchema,
  type CreateChapterInput,
  type CreateLessonInput,
  type ReorderChaptersInput,
  type ReorderLessonsInput,
  type UpdateChapterInput,
  type UpdateLessonInput,
} from "@/lib/validation/curriculum-hierarchy";
import {
  createCurriculumSchema,
  curriculumIdSchema,
  curriculumDeletionSchema,
  curriculumPermanentDeletionSchema,
  updateCurriculumSchema,
  type CreateCurriculumInput,
  type CurriculumDeletionInput,
  type CurriculumPermanentDeletionInput,
  type UpdateCurriculumInput,
} from "@/lib/validation/curriculum";

type CurriculumRow = Database["public"]["Tables"]["curriculums"]["Row"];
type CurriculumVersionRow =
  Database["public"]["Tables"]["curriculum_versions"]["Row"];
type ChapterRow = Database["public"]["Tables"]["chapters"]["Row"];
type LessonRow = Database["public"]["Tables"]["lessons"]["Row"];
type ReferenceRow = {
  code: string;
  id: string;
  name: string;
};

export interface CurriculumReferenceOptions {
  grades: ReferenceRow[];
  references: CurriculumReferenceDisplay[];
  subjects: ReferenceRow[];
}

export type CurriculumSummary = Omit<CurriculumRow, "publisher_id"> & {
  grade: ReferenceRow;
  latestVersion: number;
  reference: CurriculumReferenceDisplay;
  subject: ReferenceRow;
};

export interface CurriculumChapter extends ChapterRow {
  lessons: LessonRow[];
}

export interface CurriculumVersion extends CurriculumVersionRow {
  chapters: CurriculumChapter[];
}

export interface CurriculumDetail extends CurriculumSummary {
  versions: CurriculumVersion[];
}

export interface RecentLessonSummary {
  chapterTitle: string;
  curriculumId: string;
  curriculumName: string;
  id: string;
  title: string;
  updatedAt: string;
}

export interface CurriculumDashboardStats {
  chapterCount: number;
  lessonCount: number;
  recentLessons: RecentLessonSummary[];
}

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return new CurriculumError("service_unavailable");
  if (
    error.message?.includes("chapter_conflict") ||
    error.message?.includes("lesson_conflict")
  ) {
    return new CurriculumError("hierarchy_conflict");
  }
  if (error.message?.includes("curriculum_already_deleted")) {
    return new CurriculumError("already_deleted");
  }
  if (error.message?.includes("curriculum_not_deleted")) {
    return new CurriculumError("not_deleted");
  }
  if (error.message?.includes("published_curriculum_must_be_archived")) {
    return new CurriculumError("delete_not_allowed");
  }
  if (error.message?.includes("curriculum_dependency_blocked")) {
    return new CurriculumError("dependency_blocked");
  }
  if (error.message?.includes("curriculum_restore_name_taken")) {
    return new CurriculumError("restore_name_conflict");
  }
  if (
    error.code === "23505" ||
    error.message?.includes("curriculum_name_taken")
  ) {
    return new CurriculumError("duplicate_name");
  }
  if (error.code === "22023") return new CurriculumError("invalid_input");
  if (error.code === "P0002") return new CurriculumError("not_found");
  if (error.code === "42501") {
    if (error.message?.includes("authentication_required")) {
      return new CurriculumError("not_authenticated");
    }
    if (error.message?.includes("active_organization_required")) {
      return new CurriculumError("organization_required");
    }
    return new CurriculumError("forbidden");
  }
  return new CurriculumError("service_unavailable");
}

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

async function requireCurriculumMembership() {
  try {
    return await requireOrganizationMembership();
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

async function requireCurriculumRole(roles: readonly OrganizationRole[]) {
  try {
    return await requireOrganizationRole(roles);
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

async function requireCurriculumActor() {
  const user = await getCurrentUser();
  if (!user) throw new CurriculumError("not_authenticated");
  return user;
}

function assertAuthorized(allowed: boolean) {
  if (!allowed) throw new CurriculumError("forbidden");
}

function referenceMap(rows: ReferenceRow[]) {
  return new Map(rows.map((row) => [row.id, row]));
}

function requireReference(map: Map<string, ReferenceRow>, id: string) {
  const reference = map.get(id);
  if (!reference) throw new CurriculumError("service_unavailable");
  return reference;
}

export async function getCurriculumOptions(): Promise<CurriculumReferenceOptions> {
  await requireCurriculumMembership();
  const supabase = await createClient();
  const [subjectsResult, gradesResult, publishersResult] = await Promise.all([
    supabase
      .from("subjects")
      .select("id,code,name")
      .eq("status", "active")
      .order("display_order", { ascending: true }),
    supabase
      .from("grades")
      .select("id,code,name")
      .eq("status", "active")
      .order("display_order", { ascending: true }),
    supabase
      .from("publishers")
      .select("id,code,name")
      .eq("status", "active")
      .order("display_order", { ascending: true }),
  ]);

  if (subjectsResult.error) throw mapDatabaseError(subjectsResult.error);
  if (gradesResult.error) throw mapDatabaseError(gradesResult.error);
  if (publishersResult.error) throw mapDatabaseError(publishersResult.error);

  return {
    grades: gradesResult.data,
    references: publishersResult.data.map(toCurriculumReferenceDisplay),
    subjects: subjectsResult.data,
  };
}

async function hydrateCurriculums(
  rows: CurriculumRow[],
): Promise<CurriculumSummary[]> {
  if (rows.length === 0) return [];

  const supabase = await createClient();
  const subjectIds = [...new Set(rows.map((row) => row.subject_id))];
  const gradeIds = [...new Set(rows.map((row) => row.grade_id))];
  const publisherIds = [...new Set(rows.map((row) => row.publisher_id))];
  const curriculumIds = rows.map((row) => row.id);
  const [subjectsResult, gradesResult, publishersResult, versionsResult] =
    await Promise.all([
      supabase.from("subjects").select("id,code,name").in("id", subjectIds),
      supabase.from("grades").select("id,code,name").in("id", gradeIds),
      supabase.from("publishers").select("id,code,name").in("id", publisherIds),
      supabase
        .from("curriculum_versions")
        .select("curriculum_id,version")
        .in("curriculum_id", curriculumIds)
        .order("version", { ascending: false }),
    ]);

  if (subjectsResult.error) throw mapDatabaseError(subjectsResult.error);
  if (gradesResult.error) throw mapDatabaseError(gradesResult.error);
  if (publishersResult.error) throw mapDatabaseError(publishersResult.error);
  if (versionsResult.error) throw mapDatabaseError(versionsResult.error);

  const subjects = referenceMap(subjectsResult.data);
  const grades = referenceMap(gradesResult.data);
  const publishers = referenceMap(publishersResult.data);
  const latestVersions = new Map<string, number>();
  for (const version of versionsResult.data) {
    if (!latestVersions.has(version.curriculum_id)) {
      latestVersions.set(version.curriculum_id, version.version);
    }
  }

  return rows.map((row) => {
    const legacyReference = requireReference(publishers, row.publisher_id);

    return {
      created_at: row.created_at,
      created_by: row.created_by,
      deleted_at: row.deleted_at,
      deleted_by: row.deleted_by,
      deletion_reason: row.deletion_reason,
      grade: requireReference(grades, row.grade_id),
      grade_id: row.grade_id,
      id: row.id,
      latestVersion: latestVersions.get(row.id) ?? 0,
      name: row.name,
      organization_id: row.organization_id,
      reference: toCurriculumReferenceDisplay(legacyReference),
      school_year: row.school_year,
      semester: row.semester,
      status: row.status,
      subject: requireReference(subjects, row.subject_id),
      subject_id: row.subject_id,
      updated_at: row.updated_at,
    };
  });
}

export async function getCurriculums(): Promise<CurriculumSummary[]> {
  const context = await requireCurriculumMembership();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("curriculums")
    .select("*")
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  if (error) throw mapDatabaseError(error);
  return hydrateCurriculums(data);
}

export async function getDeletedCurriculums(): Promise<CurriculumSummary[]> {
  const context = await requireCurriculumMembership();
  const user = await requireCurriculumActor();
  const decision = await authorizeCurriculumLifecycle({
    context,
    curriculumId: context.organization.id,
    permission: "recycle_bin.read",
    user,
  });
  assertAuthorized(isAllowedDecision(decision));

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("curriculums")
    .select("*")
    .eq("organization_id", context.organization.id)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  if (error) throw mapDatabaseError(error);
  return hydrateCurriculums(data);
}

export async function getCurriculum(id: string): Promise<CurriculumDetail> {
  const parsedId = curriculumIdSchema.safeParse(id);
  if (!parsedId.success) throw new CurriculumError("not_found");

  const context = await requireCurriculumMembership();
  const supabase = await createClient();
  const { data: curriculum, error } = await supabase
    .from("curriculums")
    .select("*")
    .eq("id", parsedId.data)
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw mapDatabaseError(error);
  if (!curriculum) throw new CurriculumError("not_found");

  const [summary] = await hydrateCurriculums([curriculum]);
  if (!summary) throw new CurriculumError("not_found");

  const { data: versions, error: versionsError } = await supabase
    .from("curriculum_versions")
    .select("*")
    .eq("curriculum_id", curriculum.id)
    .order("version", { ascending: false });
  if (versionsError) throw mapDatabaseError(versionsError);

  const versionIds = versions.map((version) => version.id);
  const chaptersResult =
    versionIds.length > 0
      ? await supabase
          .from("chapters")
          .select("*")
          .in("curriculum_version_id", versionIds)
          .order("order_no", { ascending: true })
      : { data: [] as ChapterRow[], error: null };
  if (chaptersResult.error) throw mapDatabaseError(chaptersResult.error);

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

  return {
    ...summary,
    versions: versions.map((version) => ({
      ...version,
      chapters: chaptersResult.data
        .filter((chapter) => chapter.curriculum_version_id === version.id)
        .map((chapter) => ({
          ...chapter,
          lessons: lessonsResult.data.filter(
            (lesson) => lesson.chapter_id === chapter.id,
          ),
        })),
    })),
  };
}

export async function createCurriculum(
  input: CreateCurriculumInput,
): Promise<CurriculumDetail> {
  const parsed = createCurriculumSchema.safeParse(input);
  if (!parsed.success) throw new CurriculumError("invalid_input");
  await requireCurriculumRole(["organization_owner", "organization_admin"]);

  const supabase = await createClient();
  const { data: curriculumId, error } = await supabase.rpc(
    "create_curriculum_with_initial_version",
    {
      p_grade_id: parsed.data.gradeId,
      p_name: parsed.data.name,
      p_publisher_id: parsed.data.curriculumReferenceId,
      p_school_year: parsed.data.schoolYear,
      p_semester: parsed.data.semester,
      p_status: parsed.data.status === "active" ? "active" : "draft",
      p_subject_id: parsed.data.subjectId,
      p_version: 1,
      p_version_remark: parsed.data.versionRemark || null,
    },
  );

  if (error) throw mapDatabaseError(error);
  return getCurriculum(curriculumId);
}

export async function updateCurriculum(
  id: string,
  input: UpdateCurriculumInput,
): Promise<CurriculumDetail> {
  const parsedId = curriculumIdSchema.safeParse(id);
  const parsed = updateCurriculumSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    throw new CurriculumError("invalid_input");
  }

  const context = await requireCurriculumRole([
    "organization_owner",
    "organization_admin",
  ]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("curriculums")
    .update({
      grade_id: parsed.data.gradeId,
      name: parsed.data.name,
      publisher_id: parsed.data.curriculumReferenceId,
      school_year: parsed.data.schoolYear,
      semester: parsed.data.semester,
      status: parsed.data.status,
      subject_id: parsed.data.subjectId,
    })
    .eq("id", parsedId.data)
    .eq("organization_id", context.organization.id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw mapDatabaseError(error);
  if (!data) throw new CurriculumError("not_found");
  return getCurriculum(data.id);
}

async function loadCurriculumSummaryForLifecycle(input: {
  readonly id: string;
  readonly includeDeleted?: boolean;
}): Promise<CurriculumSummary> {
  const parsedId = curriculumIdSchema.safeParse(input.id);
  if (!parsedId.success) throw new CurriculumError("not_found");

  const context = await requireCurriculumMembership();
  const supabase = await createClient();
  let query = supabase
    .from("curriculums")
    .select("*")
    .eq("id", parsedId.data)
    .eq("organization_id", context.organization.id);
  if (!input.includeDeleted) query = query.is("deleted_at", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new CurriculumError("not_found");
  const [summary] = await hydrateCurriculums([data]);
  if (!summary) throw new CurriculumError("not_found");
  return summary;
}

async function hasProtectedCurriculumDependencies(
  curriculumId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("curriculum_versions")
    .select("id")
    .eq("curriculum_id", curriculumId)
    .eq("status", "published")
    .limit(1)
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  return Boolean(data);
}

async function writeLifecycleAudit(input: {
  readonly action:
    | "CURRICULUM_ARCHIVED"
    | "CURRICULUM_PERMANENTLY_DELETED"
    | "CURRICULUM_RESTORED"
    | "CURRICULUM_SOFT_DELETED";
  readonly context: Awaited<ReturnType<typeof requireCurriculumMembership>>;
  readonly curriculumId: string;
  readonly reason: string;
  readonly stateAfter: string;
  readonly stateBefore: string;
  readonly userId: string;
}) {
  const supabase = await createClient();
  return writeCurriculumLifecycleAudit({
    action: input.action,
    actingRole: input.context.membership.role,
    actorId: input.userId,
    curriculumId: input.curriculumId,
    organizationId: input.context.organization.id,
    reason: input.reason,
    stateAfter: input.stateAfter,
    stateBefore: input.stateBefore,
    supabase,
  });
}

export async function archiveCurriculum(id: string): Promise<CurriculumDetail> {
  const parsedId = curriculumIdSchema.safeParse(id);
  if (!parsedId.success) throw new CurriculumError("invalid_input");
  const context = await requireCurriculumMembership();
  const user = await requireCurriculumActor();
  const curriculum = await loadCurriculumSummaryForLifecycle({
    id: parsedId.data,
  });
  const decision = await authorizeCurriculumLifecycle({
    context,
    curriculumId: curriculum.id,
    permission: "curriculum.archive",
    user,
  });
  assertAuthorized(isAllowedDecision(decision));
  if (curriculum.status === "archived") {
    throw new CurriculumError("archive_not_allowed");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_curriculum", {
    p_curriculum_id: curriculum.id,
  });
  if (error) throw mapDatabaseError(error);
  await writeLifecycleAudit({
    action: "CURRICULUM_ARCHIVED",
    context,
    curriculumId: curriculum.id,
    reason: "USER_REQUESTED",
    stateAfter: "ARCHIVED",
    stateBefore: curriculum.status.toUpperCase(),
    userId: user.id,
  });
  return getCurriculum(data);
}

export async function restoreArchivedCurriculum(
  id: string,
): Promise<CurriculumDetail> {
  const parsedId = curriculumIdSchema.safeParse(id);
  if (!parsedId.success) throw new CurriculumError("invalid_input");
  const context = await requireCurriculumMembership();
  const user = await requireCurriculumActor();
  const curriculum = await loadCurriculumSummaryForLifecycle({
    id: parsedId.data,
  });
  const decision = await authorizeCurriculumLifecycle({
    context,
    curriculumId: curriculum.id,
    permission: "curriculum.restore",
    user,
  });
  assertAuthorized(isAllowedDecision(decision));
  if (curriculum.status !== "archived") {
    throw new CurriculumError("restore_not_allowed");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("restore_archived_curriculum", {
    p_curriculum_id: curriculum.id,
  });
  if (error) throw mapDatabaseError(error);
  await writeLifecycleAudit({
    action: "CURRICULUM_RESTORED",
    context,
    curriculumId: curriculum.id,
    reason: "USER_REQUESTED",
    stateAfter: "ACTIVE",
    stateBefore: "ARCHIVED",
    userId: user.id,
  });
  return getCurriculum(data);
}

export async function deleteCurriculum(
  id: string,
  input: CurriculumDeletionInput = {},
): Promise<CurriculumSummary> {
  const parsedId = curriculumIdSchema.safeParse(id);
  const parsed = curriculumDeletionSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    throw new CurriculumError("invalid_input");
  }
  const context = await requireCurriculumMembership();
  const user = await requireCurriculumActor();
  const curriculum = await loadCurriculumSummaryForLifecycle({
    id: parsedId.data,
  });
  const decision = await authorizeCurriculumLifecycle({
    context,
    curriculumId: curriculum.id,
    permission: "curriculum.delete",
    user,
  });
  assertAuthorized(isAllowedDecision(decision));
  if (curriculum.status === "active") {
    throw new CurriculumError("delete_not_allowed");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("soft_delete_curriculum", {
    p_curriculum_id: curriculum.id,
    p_reason: parsed.data.reason ?? null,
  });
  if (error) throw mapDatabaseError(error);
  const deleted = await loadCurriculumSummaryForLifecycle({
    id: data,
    includeDeleted: true,
  });
  await writeLifecycleAudit({
    action: "CURRICULUM_SOFT_DELETED",
    context,
    curriculumId: deleted.id,
    reason: parsed.data.reason ? "USER_REQUESTED" : "NO_REASON_PROVIDED",
    stateAfter: "DELETED",
    stateBefore: curriculum.status.toUpperCase(),
    userId: user.id,
  });
  return deleted;
}

export async function restoreDeletedCurriculum(
  id: string,
): Promise<CurriculumDetail> {
  const parsedId = curriculumIdSchema.safeParse(id);
  if (!parsedId.success) throw new CurriculumError("invalid_input");
  const context = await requireCurriculumMembership();
  const user = await requireCurriculumActor();
  const curriculum = await loadCurriculumSummaryForLifecycle({
    id: parsedId.data,
    includeDeleted: true,
  });
  if (!curriculum.deleted_at) throw new CurriculumError("not_deleted");
  const decision = await authorizeCurriculumLifecycle({
    context,
    curriculumId: curriculum.id,
    permission: "curriculum.restore",
    user,
  });
  assertAuthorized(isAllowedDecision(decision));
  const restoreDecision = evaluateCurriculumRestore({
    actorId: user.id,
    entry: curriculumToRecycleEntry(curriculum, {
      hasProtectedDependencies: false,
    }),
  });
  if (!restoreDecision.allowed)
    throw new CurriculumError("restore_not_allowed");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("restore_deleted_curriculum", {
    p_curriculum_id: curriculum.id,
  });
  if (error) throw mapDatabaseError(error);
  await writeLifecycleAudit({
    action: "CURRICULUM_RESTORED",
    context,
    curriculumId: curriculum.id,
    reason: "USER_REQUESTED",
    stateAfter: curriculum.status.toUpperCase(),
    stateBefore: "DELETED",
    userId: user.id,
  });
  return getCurriculum(data);
}

function mapPermanentDecisionToError(
  decision: ReturnType<typeof evaluateCurriculumPermanentDeletion>,
): CurriculumError {
  const actions = decision.requiredActions.map((item) => item.action);
  if (actions.includes("RETENTION_BLOCKED")) {
    return new CurriculumError("retention_blocked");
  }
  if (actions.includes("LEGAL_HOLD_BLOCKED")) {
    return new CurriculumError("legal_hold_blocked");
  }
  if (actions.includes("DEPENDENCY_BLOCKED")) {
    return new CurriculumError("dependency_blocked");
  }
  return new CurriculumError("permanent_delete_not_allowed");
}

export async function permanentlyDeleteCurriculum(
  id: string,
  input: CurriculumPermanentDeletionInput,
): Promise<string> {
  const parsedId = curriculumIdSchema.safeParse(id);
  const parsed = curriculumPermanentDeletionSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    throw new CurriculumError("invalid_input");
  }
  const context = await requireCurriculumMembership();
  const user = await requireCurriculumActor();
  const curriculum = await loadCurriculumSummaryForLifecycle({
    id: parsedId.data,
    includeDeleted: true,
  });
  if (!curriculum.deleted_at) throw new CurriculumError("not_deleted");
  if (
    parsed.data.confirmation !== curriculum.name &&
    parsed.data.confirmation !== "永久刪除"
  ) {
    throw new CurriculumError("invalid_input");
  }

  const decision = await authorizeCurriculumLifecycle({
    context,
    curriculumId: curriculum.id,
    permission: "curriculum.permanently_delete",
    user,
  });
  assertAuthorized(isAllowedDecision(decision));

  const hasDependencies = await hasProtectedCurriculumDependencies(
    curriculum.id,
  );
  const permanentDecision = evaluateCurriculumPermanentDeletion({
    actorId: user.id,
    entry: curriculumToRecycleEntry(curriculum, {
      hasProtectedDependencies: hasDependencies,
    }),
  });
  if (!permanentDecision.allowed)
    throw mapPermanentDecisionToError(permanentDecision);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("permanently_delete_curriculum", {
    p_curriculum_id: curriculum.id,
  });
  if (error) throw mapDatabaseError(error);
  await writeLifecycleAudit({
    action: "CURRICULUM_PERMANENTLY_DELETED",
    context,
    curriculumId: curriculum.id,
    reason: "USER_REQUESTED",
    stateAfter: "PERMANENTLY_DELETED",
    stateBefore: "DELETED",
    userId: user.id,
  });
  return data;
}

export async function createChapter(
  input: CreateChapterInput,
): Promise<string> {
  const parsed = createChapterSchema.safeParse(input);
  if (!parsed.success) throw new CurriculumError("invalid_input");
  await requireCurriculumRole(["organization_owner", "organization_admin"]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_chapter", {
    p_chapter_no: parsed.data.chapterNo,
    p_curriculum_version_id: parsed.data.versionId,
    p_description: parsed.data.description || null,
    p_status: parsed.data.status,
    p_title: parsed.data.title,
  });
  if (error) throw mapDatabaseError(error);
  return data;
}

export async function getChapters(curriculumId: string) {
  const curriculum = await getCurriculum(curriculumId);
  const version = curriculum.versions.find((item) => item.version === 1);
  if (!version) throw new CurriculumError("not_found");
  return { version, chapters: version.chapters };
}

export async function updateChapter(
  input: UpdateChapterInput,
): Promise<string> {
  const parsed = updateChapterSchema.safeParse(input);
  if (!parsed.success) throw new CurriculumError("invalid_input");
  await requireCurriculumRole(["organization_owner", "organization_admin"]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_chapter", {
    p_chapter_id: parsed.data.chapterId,
    p_chapter_no: parsed.data.chapterNo,
    p_description: parsed.data.description || null,
    p_status: parsed.data.status,
    p_title: parsed.data.title,
  });
  if (error) throw mapDatabaseError(error);
  return data;
}

export async function deleteChapter(chapterId: string): Promise<string> {
  const parsed = deleteChapterSchema.safeParse({ chapterId });
  if (!parsed.success) throw new CurriculumError("invalid_input");
  await requireCurriculumRole(["organization_owner", "organization_admin"]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_chapter", {
    p_chapter_id: parsed.data.chapterId,
  });
  if (error) throw mapDatabaseError(error);
  return data;
}

export async function reorderChapter(
  input: ReorderChaptersInput,
): Promise<string[]> {
  const parsed = reorderChaptersSchema.safeParse(input);
  if (!parsed.success) throw new CurriculumError("invalid_input");
  await requireCurriculumRole(["organization_owner", "organization_admin"]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reorder_chapters", {
    p_curriculum_version_id: parsed.data.versionId,
    p_ordered_ids: parsed.data.orderedIds,
  });
  if (error) throw mapDatabaseError(error);
  return data;
}

export async function createLesson(input: CreateLessonInput): Promise<string> {
  const parsed = createLessonSchema.safeParse(input);
  if (!parsed.success) throw new CurriculumError("invalid_input");
  await requireCurriculumRole(["organization_owner", "organization_admin"]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_lesson", {
    p_chapter_id: parsed.data.chapterId,
    p_estimated_minutes: parsed.data.estimatedMinutes,
    p_learning_objectives: parsed.data.learningObjectives,
    p_lesson_no: parsed.data.lessonNo,
    p_status: parsed.data.status,
    p_teaching_notes: parsed.data.teachingNotes || null,
    p_title: parsed.data.title,
  });
  if (error) throw mapDatabaseError(error);
  return data;
}

export async function getLessons(chapterId: string): Promise<LessonRow[]> {
  const parsed = deleteChapterSchema.safeParse({ chapterId });
  if (!parsed.success) throw new CurriculumError("invalid_input");
  await requireCurriculumMembership();

  const supabase = await createClient();
  const { data: chapter, error: chapterError } = await supabase
    .from("chapters")
    .select("id")
    .eq("id", parsed.data.chapterId)
    .maybeSingle();
  if (chapterError) throw mapDatabaseError(chapterError);
  if (!chapter) throw new CurriculumError("not_found");

  const { data, error } = await supabase
    .from("lessons")
    .select("*")
    .eq("chapter_id", chapter.id)
    .order("order_no", { ascending: true });
  if (error) throw mapDatabaseError(error);
  return data;
}

export async function updateLesson(input: UpdateLessonInput): Promise<string> {
  const parsed = updateLessonSchema.safeParse(input);
  if (!parsed.success) throw new CurriculumError("invalid_input");
  await requireCurriculumRole(["organization_owner", "organization_admin"]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_lesson", {
    p_estimated_minutes: parsed.data.estimatedMinutes,
    p_learning_objectives: parsed.data.learningObjectives,
    p_lesson_id: parsed.data.lessonId,
    p_lesson_no: parsed.data.lessonNo,
    p_status: parsed.data.status,
    p_teaching_notes: parsed.data.teachingNotes || null,
    p_title: parsed.data.title,
  });
  if (error) throw mapDatabaseError(error);
  return data;
}

export async function deleteLesson(lessonId: string): Promise<string> {
  const parsed = deleteLessonSchema.safeParse({ lessonId });
  if (!parsed.success) throw new CurriculumError("invalid_input");
  await requireCurriculumRole(["organization_owner", "organization_admin"]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_lesson", {
    p_lesson_id: parsed.data.lessonId,
  });
  if (error) throw mapDatabaseError(error);
  return data;
}

export async function reorderLesson(
  input: ReorderLessonsInput,
): Promise<string[]> {
  const parsed = reorderLessonsSchema.safeParse(input);
  if (!parsed.success) throw new CurriculumError("invalid_input");
  await requireCurriculumRole(["organization_owner", "organization_admin"]);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reorder_lessons", {
    p_chapter_id: parsed.data.chapterId,
    p_ordered_ids: parsed.data.orderedIds,
  });
  if (error) throw mapDatabaseError(error);
  return data;
}

export async function getCurriculumDashboardStats(
  curriculums: CurriculumSummary[],
): Promise<CurriculumDashboardStats> {
  if (curriculums.length === 0) {
    return { chapterCount: 0, lessonCount: 0, recentLessons: [] };
  }

  const supabase = await createClient();
  const curriculumIds = curriculums.map((curriculum) => curriculum.id);
  const versionsResult = await supabase
    .from("curriculum_versions")
    .select("id,curriculum_id")
    .in("curriculum_id", curriculumIds);
  if (versionsResult.error) throw mapDatabaseError(versionsResult.error);

  const versionIds = versionsResult.data.map((version) => version.id);
  if (versionIds.length === 0) {
    return { chapterCount: 0, lessonCount: 0, recentLessons: [] };
  }

  const chaptersResult = await supabase
    .from("chapters")
    .select("id,curriculum_version_id,title")
    .in("curriculum_version_id", versionIds);
  if (chaptersResult.error) throw mapDatabaseError(chaptersResult.error);

  const chapterIds = chaptersResult.data.map((chapter) => chapter.id);
  if (chapterIds.length === 0) {
    return { chapterCount: 0, lessonCount: 0, recentLessons: [] };
  }

  const lessonsResult = await supabase
    .from("lessons")
    .select("id,chapter_id,title,updated_at")
    .in("chapter_id", chapterIds)
    .order("updated_at", { ascending: false });
  if (lessonsResult.error) throw mapDatabaseError(lessonsResult.error);

  const chapters = new Map(
    chaptersResult.data.map((chapter) => [chapter.id, chapter]),
  );
  const versions = new Map(
    versionsResult.data.map((version) => [version.id, version]),
  );
  const curriculumMap = new Map(
    curriculums.map((curriculum) => [curriculum.id, curriculum]),
  );

  const recentLessons: RecentLessonSummary[] = [];
  for (const lesson of lessonsResult.data) {
    const chapter = chapters.get(lesson.chapter_id);
    const version = chapter
      ? versions.get(chapter.curriculum_version_id)
      : undefined;
    const curriculum = version
      ? curriculumMap.get(version.curriculum_id)
      : undefined;
    if (!chapter || !curriculum) continue;
    recentLessons.push({
      chapterTitle: chapter.title,
      curriculumId: curriculum.id,
      curriculumName: curriculum.name,
      id: lesson.id,
      title: lesson.title,
      updatedAt: lesson.updated_at,
    });
    if (recentLessons.length === 5) break;
  }

  return {
    chapterCount: chaptersResult.data.length,
    lessonCount: lessonsResult.data.length,
    recentLessons,
  };
}
