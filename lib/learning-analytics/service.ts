import "server-only";

import type { User } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getCurrentUser } from "@/lib/auth/session";
import {
  buildKnowledgeMasterySnapshot,
  type MasteryLevel,
} from "@/lib/learning-analytics/domain";
import { LearningAnalyticsError } from "@/lib/learning-analytics/errors";
import { OrganizationError } from "@/lib/organization/errors";
import {
  requireOrganizationMembership,
  requireOrganizationRole,
} from "@/lib/organization/service";
import { createClient } from "@/lib/supabase/server";
import {
  createLearningEventSchema,
  knowledgeSummaryQuerySchema,
  learningAnalyticsClassIdSchema,
  studentSummaryQuerySchema,
  studentTimelineQuerySchema,
  type CreateLearningEventInput,
  type KnowledgeSummaryQuery,
  type StudentSummaryQuery,
  type StudentTimelineQuery,
} from "@/lib/validation/learning-analytics";

type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];
type AssignmentStudentRow =
  Database["public"]["Tables"]["assignment_students"]["Row"];
type ClassEnrollmentRow =
  Database["public"]["Tables"]["class_enrollments"]["Row"];
type LearningEventRow = Database["public"]["Tables"]["learning_events"]["Row"];
type StudentKnowledgeMasteryRow =
  Database["public"]["Tables"]["student_knowledge_mastery"]["Row"];
type StudentSubjectSummaryRow =
  Database["public"]["Tables"]["student_subject_summary"]["Row"];
type TeacherClassSummaryRow =
  Database["public"]["Tables"]["teacher_class_summary"]["Row"];

export interface StudentSummary {
  readonly knowledgeMastery: readonly StudentKnowledgeMasteryRow[];
  readonly subjects: readonly StudentSubjectSummaryRow[];
}

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return new LearningAnalyticsError("service_unavailable");
  if (error.message?.includes("learning_event_invalid_assignment")) {
    return new LearningAnalyticsError("invalid_assignment");
  }
  if (error.message?.includes("learning_event_invalid_submission")) {
    return new LearningAnalyticsError("invalid_submission");
  }
  if (error.message?.includes("learning_event_invalid_student_assignment")) {
    return new LearningAnalyticsError("invalid_student_assignment");
  }
  if (error.code === "23505")
    return new LearningAnalyticsError("invalid_input");
  if (error.code === "22023")
    return new LearningAnalyticsError("invalid_input");
  if (error.code === "P0002") return new LearningAnalyticsError("not_found");
  if (error.code === "42501") {
    if (error.message?.includes("authentication_required")) {
      return new LearningAnalyticsError("not_authenticated");
    }
    if (error.message?.includes("active_organization_required")) {
      return new LearningAnalyticsError("organization_required");
    }
    return new LearningAnalyticsError("forbidden");
  }
  return new LearningAnalyticsError("service_unavailable");
}

function mapOrganizationError(
  error: OrganizationError,
): LearningAnalyticsError {
  switch (error.code) {
    case "not_authenticated":
      return new LearningAnalyticsError("not_authenticated");
    case "organization_not_found":
    case "not_member":
      return new LearningAnalyticsError("organization_required");
    case "forbidden":
      return new LearningAnalyticsError("forbidden");
    default:
      return new LearningAnalyticsError("service_unavailable");
  }
}

async function requireLearningActor(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new LearningAnalyticsError("not_authenticated");
  return user;
}

async function requireLearningMembership() {
  try {
    return await requireOrganizationMembership();
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

async function requireTeacherAnalyticsAccess() {
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

function requireLastEvent(rows: readonly LearningEventRow[]): LearningEventRow {
  const last = rows.at(-1);
  if (!last) throw new LearningAnalyticsError("service_unavailable");
  return last;
}

async function resolveStudentScope(requestedStudentId?: string) {
  const context = await requireLearningMembership();
  const user = await requireLearningActor();
  const studentId = requestedStudentId ?? user.id;
  if (isStudent(context.membership.role) && studentId !== user.id) {
    throw new LearningAnalyticsError("forbidden");
  }
  return { context, studentId, user };
}

async function assertTeacherCanReadStudent(
  studentId: string,
  organizationId: string,
  teacherId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_enrollments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .limit(1);
  if (error) throw mapDatabaseError(error);
  if (data.length === 0) throw new LearningAnalyticsError("not_found");

  const { data: teacherClasses, error: teacherClassError } = await supabase
    .from("classes")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("teacher_id", teacherId)
    .eq("status", "active");
  if (teacherClassError) throw mapDatabaseError(teacherClassError);
  const classIds = teacherClasses.map((row) => row.id);
  if (classIds.length === 0) throw new LearningAnalyticsError("forbidden");

  const { data: overlap, error: overlapError } = await supabase
    .from("class_enrollments")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .eq("status", "active")
    .in("class_id", classIds)
    .limit(1);
  if (overlapError) throw mapDatabaseError(overlapError);
  if (overlap.length === 0) throw new LearningAnalyticsError("forbidden");
}

async function resolveReadableStudentScope(requestedStudentId?: string) {
  const { context, studentId, user } =
    await resolveStudentScope(requestedStudentId);
  if (canReadAll(context.membership.role) || studentId === user.id) {
    return { context, studentId, user };
  }
  if (context.membership.role === "teacher") {
    await assertTeacherCanReadStudent(
      studentId,
      context.organization.id,
      user.id,
    );
    return { context, studentId, user };
  }
  throw new LearningAnalyticsError("forbidden");
}

async function writeLearningAudit(input: {
  readonly action: "LEARNING_EVENT_CREATED" | "LEARNING_SUMMARY_VIEWED";
  readonly actorId: string;
  readonly metadata?: Json;
  readonly organizationId: string;
  readonly studentId?: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("learning_audit_events").insert({
    action: input.action,
    actor_id: input.actorId,
    metadata: input.metadata ?? {},
    organization_id: input.organizationId,
    student_id: input.studentId ?? null,
  });
  if (error) throw mapDatabaseError(error);
}

async function loadAssignmentForEvent(input: {
  readonly assignmentId: string;
  readonly organizationId: string;
}): Promise<AssignmentRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", input.assignmentId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new LearningAnalyticsError("invalid_assignment");
  return data;
}

async function loadAssignmentStudentForEvent(input: {
  readonly assignmentId: string;
  readonly organizationId: string;
  readonly studentId: string;
}): Promise<AssignmentStudentRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignment_students")
    .select("*")
    .eq("assignment_id", input.assignmentId)
    .eq("organization_id", input.organizationId)
    .eq("student_id", input.studentId)
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new LearningAnalyticsError("invalid_student_assignment");
  return data;
}

async function loadClassEnrollmentForEvent(input: {
  readonly classId: string;
  readonly organizationId: string;
  readonly studentId: string;
}): Promise<ClassEnrollmentRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_enrollments")
    .select("*")
    .eq("class_id", input.classId)
    .eq("organization_id", input.organizationId)
    .eq("student_id", input.studentId)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new LearningAnalyticsError("invalid_student_assignment");
  return data;
}

async function assertSubmissionForEvent(input: {
  readonly assignmentId: string;
  readonly organizationId: string;
  readonly studentId: string;
  readonly submissionId: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignment_submissions")
    .select("id")
    .eq("id", input.submissionId)
    .eq("assignment_id", input.assignmentId)
    .eq("organization_id", input.organizationId)
    .eq("student_id", input.studentId)
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new LearningAnalyticsError("invalid_submission");
}

export async function createLearningEvent(
  input: CreateLearningEventInput,
): Promise<LearningEventRow> {
  const parsed = createLearningEventSchema.safeParse(input);
  if (!parsed.success) throw new LearningAnalyticsError("invalid_input");
  const context = await requireLearningMembership();
  const user = await requireLearningActor();
  if (isStudent(context.membership.role) && parsed.data.studentId !== user.id) {
    throw new LearningAnalyticsError("forbidden");
  }

  const assignment = await loadAssignmentForEvent({
    assignmentId: parsed.data.assignmentId,
    organizationId: context.organization.id,
  });
  if (
    assignment.curriculum_id !== parsed.data.curriculumId ||
    assignment.curriculum_version_id !== parsed.data.curriculumVersionId
  ) {
    throw new LearningAnalyticsError("invalid_assignment");
  }
  await loadAssignmentStudentForEvent({
    assignmentId: parsed.data.assignmentId,
    organizationId: context.organization.id,
    studentId: parsed.data.studentId,
  });
  await loadClassEnrollmentForEvent({
    classId: parsed.data.classId,
    organizationId: context.organization.id,
    studentId: parsed.data.studentId,
  });
  await assertSubmissionForEvent({
    assignmentId: parsed.data.assignmentId,
    organizationId: context.organization.id,
    studentId: parsed.data.studentId,
    submissionId: parsed.data.submissionId,
  });

  const attemptNumber = await resolveNextAttemptNumber({
    organizationId: context.organization.id,
    questionId: parsed.data.questionId,
    studentId: parsed.data.studentId,
    submissionId: parsed.data.submissionId,
  });
  const answeredAt = new Date().toISOString();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learning_events")
    .insert({
      answered_at: answeredAt,
      assignment_id: parsed.data.assignmentId,
      attempt_number: attemptNumber,
      class_id: parsed.data.classId,
      correct: parsed.data.correct,
      curriculum_id: parsed.data.curriculumId,
      curriculum_version_id: parsed.data.curriculumVersionId,
      difficulty: parsed.data.difficulty,
      earned_score: parsed.data.earnedScore,
      grade: parsed.data.grade,
      knowledge_point_id: parsed.data.knowledgePointId,
      learning_objective_id: parsed.data.learningObjectiveId ?? null,
      max_score: parsed.data.maxScore,
      organization_id: context.organization.id,
      question_id: parsed.data.questionId,
      student_id: parsed.data.studentId,
      subject: parsed.data.subject,
      submission_id: parsed.data.submissionId,
      time_spent_seconds: parsed.data.timeSpentSeconds,
    })
    .select("*")
    .single();
  if (error) throw mapDatabaseError(error);

  await rebuildStudentAggregates(data.student_id, data.organization_id);
  await rebuildTeacherClassSummary(data.class_id, data.organization_id);
  await writeLearningAudit({
    action: "LEARNING_EVENT_CREATED",
    actorId: user.id,
    metadata: {
      assignmentId: data.assignment_id,
      classId: data.class_id,
      knowledgePointId: data.knowledge_point_id,
      questionId: data.question_id,
    },
    organizationId: data.organization_id,
    studentId: data.student_id,
  });
  return data;
}

async function resolveNextAttemptNumber(input: {
  readonly organizationId: string;
  readonly questionId: string;
  readonly studentId: string;
  readonly submissionId: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learning_events")
    .select("attempt_number")
    .eq("organization_id", input.organizationId)
    .eq("student_id", input.studentId)
    .eq("submission_id", input.submissionId)
    .eq("question_id", input.questionId)
    .order("attempt_number", { ascending: false })
    .limit(1);
  if (error) throw mapDatabaseError(error);
  return (data[0]?.attempt_number ?? 0) + 1;
}

async function loadStudentEvents(
  studentId: string,
  organizationId: string,
): Promise<readonly LearningEventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learning_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .order("answered_at", { ascending: true });
  if (error) throw mapDatabaseError(error);
  return data;
}

async function rebuildStudentAggregates(
  studentId: string,
  organizationId: string,
) {
  const events = await loadStudentEvents(studentId, organizationId);
  if (events.length === 0) return;
  await rebuildKnowledgeMastery(studentId, organizationId, events);
  await rebuildSubjectSummaries(studentId, organizationId, events);
}

async function rebuildKnowledgeMastery(
  studentId: string,
  organizationId: string,
  events: readonly LearningEventRow[],
) {
  const byKnowledge = new Map<string, LearningEventRow[]>();
  for (const event of events) {
    byKnowledge.set(event.knowledge_point_id, [
      ...(byKnowledge.get(event.knowledge_point_id) ?? []),
      event,
    ]);
  }

  const rows = [...byKnowledge.entries()].map(([knowledgePointId, rows]) => {
    const correctCount = rows.filter((event) => event.correct).length;
    const incorrectCount = rows.length - correctCount;
    const latest = requireLastEvent(rows);
    const snapshot = buildKnowledgeMasterySnapshot({
      correctCount,
      incorrectCount,
      lastAnsweredAt: latest.answered_at,
    });
    return {
      accuracy: snapshot.accuracy,
      attempt_count: snapshot.attemptCount,
      correct_count: snapshot.correctCount,
      grade: latest.grade,
      incorrect_count: snapshot.incorrectCount,
      knowledge_point_id: knowledgePointId,
      last_answered_at: snapshot.lastAnsweredAt,
      mastery_level: snapshot.masteryLevel,
      mastery_score: snapshot.masteryScore,
      organization_id: organizationId,
      student_id: studentId,
      subject: latest.subject,
    };
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_knowledge_mastery")
    .upsert(rows, {
      onConflict: "organization_id,student_id,knowledge_point_id",
    });
  if (error) throw mapDatabaseError(error);
}

async function rebuildSubjectSummaries(
  studentId: string,
  organizationId: string,
  events: readonly LearningEventRow[],
) {
  const bySubject = new Map<string, LearningEventRow[]>();
  for (const event of events) {
    bySubject.set(`${event.subject}\u0000${event.grade}`, [
      ...(bySubject.get(`${event.subject}\u0000${event.grade}`) ?? []),
      event,
    ]);
  }

  const rows = [...bySubject.values()].map((rows) => {
    const totalMaxScore = rows.reduce((sum, event) => sum + event.max_score, 0);
    const totalEarnedScore = rows.reduce(
      (sum, event) => sum + event.earned_score,
      0,
    );
    const correctCount = rows.filter((event) => event.correct).length;
    const latest = requireLastEvent(rows);
    const distribution = buildMasteryDistribution(rows);
    return {
      accuracy: Number((correctCount / rows.length).toFixed(4)),
      average_score:
        totalMaxScore === 0
          ? 0
          : Number((totalEarnedScore / totalMaxScore).toFixed(4)),
      grade: latest.grade,
      knowledge_count: new Set(rows.map((event) => event.knowledge_point_id))
        .size,
      last_activity: latest.answered_at,
      mastery_distribution: distribution,
      organization_id: organizationId,
      question_count: rows.length,
      student_id: studentId,
      subject: latest.subject,
    };
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from("student_subject_summary")
    .upsert(rows, { onConflict: "organization_id,student_id,subject,grade" });
  if (error) throw mapDatabaseError(error);
}

function buildMasteryDistribution(
  events: readonly LearningEventRow[],
): Record<MasteryLevel, number> {
  const result: Record<MasteryLevel, number> = {
    beginner: 0,
    developing: 0,
    mastered: 0,
    proficient: 0,
    unknown: 0,
  };
  const byKnowledge = new Map<string, LearningEventRow[]>();
  for (const event of events) {
    byKnowledge.set(event.knowledge_point_id, [
      ...(byKnowledge.get(event.knowledge_point_id) ?? []),
      event,
    ]);
  }
  for (const rows of byKnowledge.values()) {
    const snapshot = buildKnowledgeMasterySnapshot({
      correctCount: rows.filter((event) => event.correct).length,
      incorrectCount: rows.filter((event) => !event.correct).length,
      lastAnsweredAt: requireLastEvent(rows).answered_at,
    });
    result[snapshot.masteryLevel] += 1;
  }
  return result;
}

async function rebuildTeacherClassSummary(
  classId: string,
  organizationId: string,
) {
  const supabase = await createClient();
  const { data: classroom, error: classError } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (classError) throw mapDatabaseError(classError);
  if (!classroom) return;

  const { data: events, error } = await supabase
    .from("learning_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("class_id", classId)
    .order("answered_at", { ascending: true });
  if (error) throw mapDatabaseError(error);
  if (events.length === 0) return;

  const correctCount = events.filter((event) => event.correct).length;
  const knowledgeDistribution = buildKnowledgeDistribution(events);
  const weakKnowledgeRanking = buildWeakKnowledgeRanking(events);
  const activityTrend = buildActivityTrend(events);
  const lastEvent = requireLastEvent(events);
  const { error: upsertError } = await supabase
    .from("teacher_class_summary")
    .upsert(
      {
        accuracy: Number((correctCount / events.length).toFixed(4)),
        activity_trend: activityTrend,
        class_id: classId,
        grade: classroom.grade,
        knowledge_distribution: knowledgeDistribution,
        last_activity: lastEvent.answered_at,
        organization_id: organizationId,
        question_count: events.length,
        student_count: new Set(events.map((event) => event.student_id)).size,
        subject: classroom.subject,
        teacher_id: classroom.teacher_id,
        weak_knowledge_ranking: weakKnowledgeRanking,
      },
      { onConflict: "organization_id,class_id,subject,grade" },
    );
  if (upsertError) throw mapDatabaseError(upsertError);
}

function buildKnowledgeDistribution(
  events: readonly LearningEventRow[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const event of events) {
    result[event.knowledge_point_id] =
      (result[event.knowledge_point_id] ?? 0) + 1;
  }
  return result;
}

function buildWeakKnowledgeRanking(events: readonly LearningEventRow[]) {
  const byKnowledge = new Map<string, LearningEventRow[]>();
  for (const event of events) {
    byKnowledge.set(event.knowledge_point_id, [
      ...(byKnowledge.get(event.knowledge_point_id) ?? []),
      event,
    ]);
  }
  return [...byKnowledge.entries()]
    .map(([knowledgePointId, rows]) => ({
      accuracy: Number(
        (rows.filter((event) => event.correct).length / rows.length).toFixed(4),
      ),
      attemptCount: rows.length,
      knowledgePointId,
    }))
    .sort((a, b) => a.accuracy - b.accuracy || b.attemptCount - a.attemptCount)
    .slice(0, 10);
}

function buildActivityTrend(events: readonly LearningEventRow[]) {
  const byDate = new Map<string, LearningEventRow[]>();
  for (const event of events) {
    const date = event.answered_at.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), event]);
  }
  return [...byDate.entries()].map(([date, rows]) => ({
    accuracy: Number(
      (rows.filter((event) => event.correct).length / rows.length).toFixed(4),
    ),
    date,
    questionCount: rows.length,
  }));
}

export async function getStudentSummary(
  input: StudentSummaryQuery = {},
): Promise<StudentSummary> {
  const parsed = studentSummaryQuerySchema.safeParse(input);
  if (!parsed.success) throw new LearningAnalyticsError("invalid_input");
  const { context, studentId, user } = await resolveReadableStudentScope(
    parsed.data.studentId,
  );
  const supabase = await createClient();
  const { data: knowledgeMastery, error: masteryError } = await supabase
    .from("student_knowledge_mastery")
    .select("*")
    .eq("organization_id", context.organization.id)
    .eq("student_id", studentId)
    .order("last_answered_at", { ascending: false });
  if (masteryError) throw mapDatabaseError(masteryError);

  const { data: subjects, error: subjectError } = await supabase
    .from("student_subject_summary")
    .select("*")
    .eq("organization_id", context.organization.id)
    .eq("student_id", studentId)
    .order("last_activity", { ascending: false });
  if (subjectError) throw mapDatabaseError(subjectError);
  await writeLearningAudit({
    action: "LEARNING_SUMMARY_VIEWED",
    actorId: user.id,
    metadata: { view: "student_summary" },
    organizationId: context.organization.id,
    studentId,
  });
  return { knowledgeMastery, subjects };
}

export async function getStudentTimeline(
  input: StudentTimelineQuery = {},
): Promise<readonly LearningEventRow[]> {
  const parsed = studentTimelineQuerySchema.safeParse(input);
  if (!parsed.success) throw new LearningAnalyticsError("invalid_input");
  const { context, studentId, user } = await resolveReadableStudentScope(
    parsed.data.studentId,
  );
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learning_events")
    .select("*")
    .eq("organization_id", context.organization.id)
    .eq("student_id", studentId)
    .order("answered_at", { ascending: false })
    .limit(parsed.data.limit ?? 100);
  if (error) throw mapDatabaseError(error);
  await writeLearningAudit({
    action: "LEARNING_SUMMARY_VIEWED",
    actorId: user.id,
    metadata: { view: "student_timeline" },
    organizationId: context.organization.id,
    studentId,
  });
  return data;
}

export async function getKnowledgeSummary(
  input: KnowledgeSummaryQuery = {},
): Promise<readonly StudentKnowledgeMasteryRow[]> {
  const parsed = knowledgeSummaryQuerySchema.safeParse(input);
  if (!parsed.success) throw new LearningAnalyticsError("invalid_input");
  const { context, studentId, user } = await resolveReadableStudentScope(
    parsed.data.studentId,
  );
  let query = (await createClient())
    .from("student_knowledge_mastery")
    .select("*")
    .eq("organization_id", context.organization.id)
    .eq("student_id", studentId);
  if (parsed.data.knowledgePointId) {
    query = query.eq("knowledge_point_id", parsed.data.knowledgePointId);
  }
  const { data, error } = await query.order("mastery_score", {
    ascending: true,
  });
  if (error) throw mapDatabaseError(error);
  await writeLearningAudit({
    action: "LEARNING_SUMMARY_VIEWED",
    actorId: user.id,
    metadata: { view: "knowledge_summary" },
    organizationId: context.organization.id,
    studentId,
  });
  return data;
}

export async function getTeacherClassSummary(
  classId: string,
): Promise<TeacherClassSummaryRow> {
  const parsedId = learningAnalyticsClassIdSchema.safeParse(classId);
  if (!parsedId.success) throw new LearningAnalyticsError("invalid_input");
  const context = await requireTeacherAnalyticsAccess();
  const user = await requireLearningActor();
  const supabase = await createClient();
  let query = supabase
    .from("teacher_class_summary")
    .select("*")
    .eq("organization_id", context.organization.id)
    .eq("class_id", parsedId.data);
  if (!canReadAll(context.membership.role)) {
    query = query.eq("teacher_id", user.id);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new LearningAnalyticsError("not_found");
  await writeLearningAudit({
    action: "LEARNING_SUMMARY_VIEWED",
    actorId: user.id,
    metadata: { classId: parsedId.data, view: "teacher_class_summary" },
    organizationId: context.organization.id,
  });
  return data;
}

export async function getWeakKnowledgeRanking(classId: string) {
  const summary = await getTeacherClassSummary(classId);
  return summary.weak_knowledge_ranking;
}
