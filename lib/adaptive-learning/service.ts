import "server-only";

import type { User } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getCurrentUser } from "@/lib/auth/session";
import {
  buildAdaptiveLearningResult,
  recommendDifficulty,
  type KnowledgeMasteryInput,
  type TimelineInput,
} from "@/lib/adaptive-learning/domain";
import { AdaptiveLearningError } from "@/lib/adaptive-learning/errors";
import { OrganizationError } from "@/lib/organization/errors";
import {
  requireOrganizationMembership,
  requireOrganizationRole,
} from "@/lib/organization/service";
import { createClient } from "@/lib/supabase/server";
import {
  adaptiveStudentRecommendationQuerySchema,
  type AdaptiveStudentRecommendationQuery,
} from "@/lib/validation/adaptive-learning";

type LearningEventRow = Database["public"]["Tables"]["learning_events"]["Row"];
type LearningRecommendationRow =
  Database["public"]["Tables"]["learning_recommendations"]["Row"];
type LearningPathRow = Database["public"]["Tables"]["learning_paths"]["Row"];
type StudentKnowledgeMasteryRow =
  Database["public"]["Tables"]["student_knowledge_mastery"]["Row"];

export interface AdaptiveRecommendationResult {
  readonly paths: readonly LearningPathRow[];
  readonly recommendations: readonly LearningRecommendationRow[];
}

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return new AdaptiveLearningError("service_unavailable");
  if (error.message?.includes("adaptive_learning_analytics_required")) {
    return new AdaptiveLearningError("analytics_required");
  }
  if (error.message?.includes("adaptive_learning_invalid_student")) {
    return new AdaptiveLearningError("forbidden");
  }
  if (error.code === "23505") return new AdaptiveLearningError("invalid_input");
  if (error.code === "22023") return new AdaptiveLearningError("invalid_input");
  if (error.code === "P0002") return new AdaptiveLearningError("not_found");
  if (error.code === "42501") {
    if (error.message?.includes("authentication_required")) {
      return new AdaptiveLearningError("not_authenticated");
    }
    if (error.message?.includes("active_organization_required")) {
      return new AdaptiveLearningError("organization_required");
    }
    return new AdaptiveLearningError("forbidden");
  }
  return new AdaptiveLearningError("service_unavailable");
}

function mapOrganizationError(error: OrganizationError): AdaptiveLearningError {
  switch (error.code) {
    case "not_authenticated":
      return new AdaptiveLearningError("not_authenticated");
    case "organization_not_found":
    case "not_member":
      return new AdaptiveLearningError("organization_required");
    case "forbidden":
      return new AdaptiveLearningError("forbidden");
    default:
      return new AdaptiveLearningError("service_unavailable");
  }
}

async function requireAdaptiveActor(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AdaptiveLearningError("not_authenticated");
  return user;
}

async function requireAdaptiveMembership() {
  try {
    return await requireOrganizationMembership();
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

async function requireTeacherAdaptiveAccess() {
  try {
    return await requireOrganizationRole([
      "organization_owner",
      "organization_admin",
      "teacher",
    ]);
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

function canReadAll(role: string): boolean {
  return role === "organization_owner" || role === "organization_admin";
}

function isStudent(role: string): boolean {
  return role === "student";
}

async function resolveReadableStudentScope(input: {
  readonly studentId?: string;
}) {
  const context = await requireAdaptiveMembership();
  const user = await requireAdaptiveActor();
  const studentId = input.studentId ?? user.id;
  if (isStudent(context.membership.role) && studentId !== user.id) {
    throw new AdaptiveLearningError("forbidden");
  }
  if (canReadAll(context.membership.role) || studentId === user.id) {
    return { context, studentId, user };
  }
  if (context.membership.role !== "teacher") {
    throw new AdaptiveLearningError("forbidden");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_enrollments")
    .select("id")
    .eq("organization_id", context.organization.id)
    .eq("student_id", studentId)
    .eq("status", "active")
    .limit(1);
  if (error) throw mapDatabaseError(error);
  if (data.length === 0) throw new AdaptiveLearningError("not_found");

  const teacherClassIds = await loadTeacherClassIds(
    user.id,
    context.organization.id,
  );
  if (teacherClassIds.length === 0) {
    throw new AdaptiveLearningError("forbidden");
  }

  const { data: ownClassOverlap, error: overlapError } = await supabase
    .from("class_enrollments")
    .select("id")
    .eq("organization_id", context.organization.id)
    .eq("student_id", studentId)
    .eq("status", "active")
    .in("class_id", teacherClassIds)
    .limit(1);
  if (overlapError) throw mapDatabaseError(overlapError);
  if (ownClassOverlap.length === 0) {
    throw new AdaptiveLearningError("forbidden");
  }
  return { context, studentId, user };
}

async function loadTeacherClassIds(
  teacherId: string,
  organizationId: string,
): Promise<readonly string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("teacher_id", teacherId)
    .eq("status", "active");
  if (error) throw mapDatabaseError(error);
  return data.map((row) => row.id);
}

async function writeAdaptiveAudit(input: {
  readonly action: "LEARNING_PATH_VIEWED" | "LEARNING_RECOMMENDATION_CREATED";
  readonly actorId: string;
  readonly metadata?: Json;
  readonly organizationId: string;
  readonly studentId: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("learning_recommendation_audit_events")
    .insert({
      action: input.action,
      actor_id: input.actorId,
      metadata: input.metadata ?? {},
      organization_id: input.organizationId,
      student_id: input.studentId,
    });
  if (error) throw mapDatabaseError(error);
}

async function loadMastery(input: {
  readonly organizationId: string;
  readonly studentId: string;
  readonly subject?: string;
}): Promise<readonly StudentKnowledgeMasteryRow[]> {
  let query = (await createClient())
    .from("student_knowledge_mastery")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("student_id", input.studentId);
  if (input.subject) query = query.eq("subject", input.subject);
  const { data, error } = await query.order("mastery_score", {
    ascending: true,
  });
  if (error) throw mapDatabaseError(error);
  return data;
}

async function loadTimeline(input: {
  readonly organizationId: string;
  readonly studentId: string;
  readonly subject?: string;
}): Promise<readonly LearningEventRow[]> {
  let query = (await createClient())
    .from("learning_events")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("student_id", input.studentId);
  if (input.subject) query = query.eq("subject", input.subject);
  const { data, error } = await query
    .order("answered_at", { ascending: true })
    .limit(300);
  if (error) throw mapDatabaseError(error);
  return data;
}

function mapMastery(row: StudentKnowledgeMasteryRow): KnowledgeMasteryInput {
  return {
    accuracy: row.accuracy,
    attemptCount: row.attempt_count,
    knowledgePointId: row.knowledge_point_id,
    lastAnsweredAt: row.last_answered_at,
    masteryLevel: row.mastery_level,
    masteryScore: row.mastery_score,
  };
}

function mapTimeline(row: LearningEventRow): TimelineInput {
  return {
    answeredAt: row.answered_at,
    correct: row.correct,
    difficulty: row.difficulty,
    knowledgePointId: row.knowledge_point_id,
  };
}

export async function generateStudentRecommendations(
  input: AdaptiveStudentRecommendationQuery = {},
): Promise<AdaptiveRecommendationResult> {
  const parsed = adaptiveStudentRecommendationQuerySchema.safeParse(input);
  if (!parsed.success) throw new AdaptiveLearningError("invalid_input");
  const { context, studentId, user } = await resolveReadableStudentScope({
    studentId: parsed.data.studentId,
  });
  const masteryRows = await loadMastery({
    organizationId: context.organization.id,
    studentId,
    subject: parsed.data.subject,
  });
  if (masteryRows.length === 0) {
    throw new AdaptiveLearningError("analytics_required");
  }
  const timelineRows = await loadTimeline({
    organizationId: context.organization.id,
    studentId,
    subject: parsed.data.subject,
  });
  const firstMastery = masteryRows[0];
  if (!firstMastery) throw new AdaptiveLearningError("analytics_required");
  const result = buildAdaptiveLearningResult({
    grade: firstMastery.grade,
    mastery: masteryRows.map(mapMastery),
    organizationId: context.organization.id,
    studentId,
    subject: firstMastery.subject,
    timeline: timelineRows.map(mapTimeline),
  });
  if (result.recommendations.length === 0) {
    throw new AdaptiveLearningError("analytics_required");
  }

  const supabase = await createClient();
  const { data: recommendations, error: recommendationError } = await supabase
    .from("learning_recommendations")
    .upsert(
      result.recommendations.map((recommendation) => ({
        knowledge_point_id: recommendation.knowledgePointId,
        organization_id: recommendation.organizationId,
        reason: recommendation.reason,
        recommended_curriculum_type: recommendation.recommendedCurriculumType,
        recommended_difficulty: recommendation.recommendedDifficulty,
        recommended_question_count: recommendation.recommendedQuestionCount,
        student_id: recommendation.studentId,
        subject: recommendation.subject,
        grade: recommendation.grade,
      })),
      {
        onConflict:
          "organization_id,student_id,knowledge_point_id,subject,grade",
      },
    )
    .select("*");
  if (recommendationError) throw mapDatabaseError(recommendationError);

  const { data: paths, error: pathError } = await supabase
    .from("learning_paths")
    .upsert(
      result.paths.map((path) => ({
        current_knowledge_point_id: path.current,
        next_step: path.nextStep,
        organization_id: context.organization.id,
        recommended_ability: path.recommendedAbility,
        recommended_curriculum: path.recommendedCurriculum,
        student_id: studentId,
        subject: firstMastery.subject,
        grade: firstMastery.grade,
      })),
      {
        onConflict:
          "organization_id,student_id,current_knowledge_point_id,subject,grade",
      },
    )
    .select("*");
  if (pathError) throw mapDatabaseError(pathError);

  await writeAdaptiveAudit({
    action: "LEARNING_RECOMMENDATION_CREATED",
    actorId: user.id,
    metadata: {
      recommendationCount: recommendations.length,
      subject: firstMastery.subject,
    },
    organizationId: context.organization.id,
    studentId,
  });
  return { paths, recommendations };
}

export async function getStudentRecommendations(
  input: AdaptiveStudentRecommendationQuery = {},
): Promise<readonly LearningRecommendationRow[]> {
  return (await generateStudentRecommendations(input)).recommendations;
}

export async function getLearningPathRecommendations(
  input: AdaptiveStudentRecommendationQuery = {},
): Promise<readonly LearningPathRow[]> {
  const result = await generateStudentRecommendations(input);
  const actor = await requireAdaptiveActor();
  const context = await requireAdaptiveMembership();
  await writeAdaptiveAudit({
    action: "LEARNING_PATH_VIEWED",
    actorId: actor.id,
    metadata: { pathCount: result.paths.length },
    organizationId: context.organization.id,
    studentId: input.studentId ?? actor.id,
  });
  return result.paths;
}

export async function getWeakKnowledge(
  input: AdaptiveStudentRecommendationQuery = {},
) {
  const recommendations = await getStudentRecommendations(input);
  return recommendations.map((recommendation) => ({
    knowledgePointId: recommendation.knowledge_point_id,
    reason: recommendation.reason,
  }));
}

export async function getDifficultyRecommendations(
  input: AdaptiveStudentRecommendationQuery = {},
) {
  const parsed = adaptiveStudentRecommendationQuerySchema.safeParse(input);
  if (!parsed.success) throw new AdaptiveLearningError("invalid_input");
  const { context, studentId } = await resolveReadableStudentScope({
    studentId: parsed.data.studentId,
  });
  const masteryRows = await loadMastery({
    organizationId: context.organization.id,
    studentId,
    subject: parsed.data.subject,
  });
  const timelineRows = await loadTimeline({
    organizationId: context.organization.id,
    studentId,
    subject: parsed.data.subject,
  });
  if (masteryRows.length === 0) {
    throw new AdaptiveLearningError("analytics_required");
  }
  return masteryRows.map((row) =>
    recommendDifficulty({
      mastery: mapMastery(row),
      recentTimeline: timelineRows.map(mapTimeline),
    }),
  );
}

export async function assertTeacherRecommendationBoundary() {
  await requireTeacherAdaptiveAccess();
}
