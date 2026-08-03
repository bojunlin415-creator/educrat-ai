import "server-only";

import type { User } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getCurrentUser } from "@/lib/auth/session";
import {
  buildMasterySummary,
  calculateAverage,
  REPORT_EXPORT_CONTRACTS,
  type OrganizationReportViewModel,
  type StudentReportViewModel,
  type TeacherReportViewModel,
  type TrendPoint,
} from "@/lib/reporting/domain";
import { ReportingError } from "@/lib/reporting/errors";
import { OrganizationError } from "@/lib/organization/errors";
import {
  requireOrganizationMembership,
  requireOrganizationRole,
} from "@/lib/organization/service";
import { createClient } from "@/lib/supabase/server";
import {
  studentReportQuerySchema,
  teacherReportQuerySchema,
  type StudentReportQuery,
  type TeacherReportQuery,
} from "@/lib/validation/reporting";

type LearningEventRow = Database["public"]["Tables"]["learning_events"]["Row"];
type StudentKnowledgeMasteryRow =
  Database["public"]["Tables"]["student_knowledge_mastery"]["Row"];
type StudentSubjectSummaryRow =
  Database["public"]["Tables"]["student_subject_summary"]["Row"];
type TeacherClassSummaryRow =
  Database["public"]["Tables"]["teacher_class_summary"]["Row"];

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return new ReportingError("service_unavailable");
  if (error.code === "P0002") return new ReportingError("not_found");
  if (error.code === "22023") return new ReportingError("invalid_input");
  if (error.code === "42501") {
    if (error.message?.includes("authentication_required")) {
      return new ReportingError("not_authenticated");
    }
    if (error.message?.includes("active_organization_required")) {
      return new ReportingError("organization_required");
    }
    return new ReportingError("forbidden");
  }
  return new ReportingError("service_unavailable");
}

function mapOrganizationError(error: OrganizationError): ReportingError {
  switch (error.code) {
    case "not_authenticated":
      return new ReportingError("not_authenticated");
    case "organization_not_found":
    case "not_member":
      return new ReportingError("organization_required");
    case "forbidden":
      return new ReportingError("forbidden");
    default:
      return new ReportingError("service_unavailable");
  }
}

async function requireReportingActor(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ReportingError("not_authenticated");
  return user;
}

async function requireReportingMembership() {
  try {
    return await requireOrganizationMembership();
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

async function requireOrganizationReportAccess() {
  try {
    return await requireOrganizationRole([
      "organization_owner",
      "organization_admin",
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

function isGuardian(role: string): boolean {
  return role === "guardian";
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

async function requireGuardianStudentRelationship(input: {
  readonly guardianId: string;
  readonly organizationId: string;
  readonly studentId: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_guardians")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("guardian_user_id", input.guardianId)
    .eq("student_id", input.studentId)
    .eq("status", "active")
    .limit(1);
  if (error) throw mapDatabaseError(error);
  if (data.length === 0) throw new ReportingError("forbidden");
}

async function resolveReadableStudentScope(studentId?: string) {
  const context = await requireReportingMembership();
  const user = await requireReportingActor();
  const resolvedStudentId = studentId ?? user.id;
  if (isStudent(context.membership.role) && resolvedStudentId !== user.id) {
    throw new ReportingError("forbidden");
  }
  if (canReadAll(context.membership.role) || resolvedStudentId === user.id) {
    return { context, studentId: resolvedStudentId, user };
  }
  if (isGuardian(context.membership.role)) {
    await requireGuardianStudentRelationship({
      guardianId: user.id,
      organizationId: context.organization.id,
      studentId: resolvedStudentId,
    });
    return { context, studentId: resolvedStudentId, user };
  }
  if (context.membership.role !== "teacher") {
    throw new ReportingError("forbidden");
  }
  const classIds = await loadTeacherClassIds(user.id, context.organization.id);
  if (classIds.length === 0) throw new ReportingError("forbidden");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_enrollments")
    .select("id")
    .eq("organization_id", context.organization.id)
    .eq("student_id", resolvedStudentId)
    .eq("status", "active")
    .in("class_id", classIds)
    .limit(1);
  if (error) throw mapDatabaseError(error);
  if (data.length === 0) throw new ReportingError("forbidden");
  return { context, studentId: resolvedStudentId, user };
}

async function writeReportAudit(input: {
  readonly action: "REPORT_EXPORTED" | "REPORT_VIEWED";
  readonly actorId: string;
  readonly metadata?: Json;
  readonly organizationId: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("report_audit_events").insert({
    action: input.action,
    actor_id: input.actorId,
    metadata: input.metadata ?? {},
    organization_id: input.organizationId,
  });
  if (error) throw mapDatabaseError(error);
}

export async function getStudentReport(
  input: StudentReportQuery = {},
): Promise<StudentReportViewModel> {
  const parsed = studentReportQuerySchema.safeParse(input);
  if (!parsed.success) throw new ReportingError("invalid_input");
  const { context, studentId, user } = await resolveReadableStudentScope(
    parsed.data.studentId,
  );
  const supabase = await createClient();
  const { data: subjectRows, error: subjectError } = await supabase
    .from("student_subject_summary")
    .select("*")
    .eq("organization_id", context.organization.id)
    .eq("student_id", studentId);
  if (subjectError) throw mapDatabaseError(subjectError);

  const { data: masteryRows, error: masteryError } = await supabase
    .from("student_knowledge_mastery")
    .select("*")
    .eq("organization_id", context.organization.id)
    .eq("student_id", studentId)
    .order("mastery_score", { ascending: true });
  if (masteryError) throw mapDatabaseError(masteryError);

  const { data: recommendationRows, error: recommendationError } =
    await supabase
      .from("learning_recommendations")
      .select("*")
      .eq("organization_id", context.organization.id)
      .eq("student_id", studentId);
  if (recommendationError) throw mapDatabaseError(recommendationError);

  const trend = await loadStudentTrend(studentId, context.organization.id);
  await writeReportAudit({
    action: "REPORT_VIEWED",
    actorId: user.id,
    metadata: { report: "student", studentId },
    organizationId: context.organization.id,
  });
  return {
    learningTrend: trend,
    masterySummary: buildMasterySummary(
      subjectRows.map((row) => asNumberRecord(row.mastery_distribution)),
    ),
    overallAccuracy: calculateAverage(subjectRows.map((row) => row.accuracy)),
    recommendationCount: recommendationRows.length,
    recommendedDifficulty: recommendationRows.map((row) => ({
      difficulty: row.recommended_difficulty,
      knowledgePointId: row.knowledge_point_id,
    })),
    studentId,
    weakKnowledge: masteryRows.slice(0, 10).map((row) => ({
      knowledgePointId: row.knowledge_point_id,
      masteryScore: row.mastery_score,
      reason: buildWeakKnowledgeReason(row),
    })),
  };
}

export async function getTeacherReport(
  input: TeacherReportQuery,
): Promise<TeacherReportViewModel> {
  const parsed = teacherReportQuerySchema.safeParse(input);
  if (!parsed.success) throw new ReportingError("invalid_input");
  const context = await requireReportingMembership();
  const user = await requireReportingActor();
  if (!canReadAll(context.membership.role)) {
    const classIds = await loadTeacherClassIds(
      user.id,
      context.organization.id,
    );
    if (!classIds.some((classId) => classId === parsed.data.classId)) {
      throw new ReportingError("forbidden");
    }
  }
  const supabase = await createClient();
  const { data: summary, error } = await supabase
    .from("teacher_class_summary")
    .select("*")
    .eq("organization_id", context.organization.id)
    .eq("class_id", parsed.data.classId)
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!summary) throw new ReportingError("not_found");

  const ranking = await loadClassStudentRanking(
    parsed.data.classId,
    context.organization.id,
  );
  const completion = await loadAssignmentCompletion(
    parsed.data.classId,
    context.organization.id,
  );
  await writeReportAudit({
    action: "REPORT_VIEWED",
    actorId: user.id,
    metadata: { classId: parsed.data.classId, report: "teacher" },
    organizationId: context.organization.id,
  });
  return {
    activityTrend: asTrend(summary.activity_trend),
    assignmentCompletion: completion,
    classAccuracy: summary.accuracy,
    classId: parsed.data.classId,
    studentRanking: ranking,
    weakKnowledgeRanking: asWeakKnowledgeRanking(
      summary.weak_knowledge_ranking,
    ),
  };
}

export async function getOrganizationReport(): Promise<OrganizationReportViewModel> {
  const context = await requireOrganizationReportAccess();
  const user = await requireReportingActor();
  const supabase = await createClient();
  const { data: classRows, error: classError } = await supabase
    .from("teacher_class_summary")
    .select("*")
    .eq("organization_id", context.organization.id);
  if (classError) throw mapDatabaseError(classError);

  await writeReportAudit({
    action: "REPORT_VIEWED",
    actorId: user.id,
    metadata: { report: "organization" },
    organizationId: context.organization.id,
  });
  return {
    classComparison: classRows.map((row) => ({
      accuracy: row.accuracy,
      classId: row.class_id,
    })),
    knowledgeDistribution: mergeKnowledgeDistributions(classRows),
    learningActivity: mergeActivityTrend(classRows),
    organizationAccuracy: calculateAverage(
      classRows.map((row) => row.accuracy),
    ),
    organizationId: context.organization.id,
    teacherComparison: buildTeacherComparison(classRows),
  };
}

export async function getReportExportOptions() {
  const context = await requireReportingMembership();
  const user = await requireReportingActor();
  await writeReportAudit({
    action: "REPORT_VIEWED",
    actorId: user.id,
    metadata: { report: "export_options" },
    organizationId: context.organization.id,
  });
  return REPORT_EXPORT_CONTRACTS;
}

function asNumberRecord(value: Json): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, number] => typeof entry[1] === "number",
    ),
  );
}

function asTrend(value: Json): readonly TrendPoint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, Json | undefined>;
    return typeof candidate.date === "string" &&
      typeof candidate.questionCount === "number" &&
      typeof candidate.accuracy === "number"
      ? [
          {
            accuracy: candidate.accuracy,
            date: candidate.date,
            questionCount: candidate.questionCount,
          },
        ]
      : [];
  });
}

function asWeakKnowledgeRanking(value: Json) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Record<string, Json | undefined>;
    return typeof candidate.knowledgePointId === "string" &&
      typeof candidate.accuracy === "number" &&
      typeof candidate.attemptCount === "number"
      ? [
          {
            accuracy: candidate.accuracy,
            attemptCount: candidate.attemptCount,
            knowledgePointId: candidate.knowledgePointId,
          },
        ]
      : [];
  });
}

async function loadStudentTrend(
  studentId: string,
  organizationId: string,
): Promise<readonly TrendPoint[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("learning_events")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .order("answered_at", { ascending: true })
    .limit(300);
  if (error) throw mapDatabaseError(error);
  return buildTrend(data);
}

function buildTrend(
  events: readonly LearningEventRow[],
): readonly TrendPoint[] {
  const byDate = new Map<string, LearningEventRow[]>();
  for (const event of events) {
    const date = event.answered_at.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), event]);
  }
  return [...byDate.entries()].map(([date, rows]) => ({
    accuracy: calculateAverage(rows.map((row) => (row.correct ? 1 : 0))),
    date,
    questionCount: rows.length,
  }));
}

function buildWeakKnowledgeReason(row: StudentKnowledgeMasteryRow): string {
  if (row.attempt_count < 3) return "作答次數不足，需補充觀察。";
  if (row.mastery_score < 0.5) return "掌握度偏低，建議補救練習。";
  return "仍可透過複習提升穩定度。";
}

async function loadClassStudentRanking(
  classId: string,
  organizationId: string,
) {
  const supabase = await createClient();
  const { data: enrollments, error: enrollmentError } = await supabase
    .from("class_enrollments")
    .select("student_id")
    .eq("organization_id", organizationId)
    .eq("class_id", classId)
    .eq("status", "active");
  if (enrollmentError) throw mapDatabaseError(enrollmentError);
  if (enrollments.length === 0) return [];
  const { data: subjects, error: subjectError } = await supabase
    .from("student_subject_summary")
    .select("*")
    .eq("organization_id", organizationId)
    .in(
      "student_id",
      enrollments.map((row) => row.student_id),
    );
  if (subjectError) throw mapDatabaseError(subjectError);
  const byStudent = new Map<string, StudentSubjectSummaryRow[]>();
  for (const subject of subjects) {
    byStudent.set(subject.student_id, [
      ...(byStudent.get(subject.student_id) ?? []),
      subject,
    ]);
  }
  return [...byStudent.entries()]
    .map(([studentId, rows]) => ({
      accuracy: calculateAverage(rows.map((row) => row.accuracy)),
      studentId,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);
}

async function loadAssignmentCompletion(
  classId: string,
  organizationId: string,
) {
  const supabase = await createClient();
  const { data: targets, error: targetError } = await supabase
    .from("assignment_classes")
    .select("assignment_id")
    .eq("organization_id", organizationId)
    .eq("class_id", classId);
  if (targetError) throw mapDatabaseError(targetError);
  if (targets.length === 0) {
    return { assigned: 0, submissionRate: 0, submitted: 0 };
  }
  const { data: students, error: studentError } = await supabase
    .from("assignment_students")
    .select("status")
    .eq("organization_id", organizationId)
    .in(
      "assignment_id",
      targets.map((row) => row.assignment_id),
    );
  if (studentError) throw mapDatabaseError(studentError);
  const submitted = students.filter((row) => row.status === "submitted").length;
  return {
    assigned: students.length,
    submissionRate:
      students.length === 0
        ? 0
        : Number((submitted / students.length).toFixed(4)),
    submitted,
  };
}

function mergeKnowledgeDistributions(
  summaries: readonly TeacherClassSummaryRow[],
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const summary of summaries) {
    for (const [key, value] of Object.entries(
      asNumberRecord(summary.knowledge_distribution),
    )) {
      result[key] = (result[key] ?? 0) + value;
    }
  }
  return result;
}

function mergeActivityTrend(
  summaries: readonly TeacherClassSummaryRow[],
): readonly TrendPoint[] {
  const byDate = new Map<string, TrendPoint[]>();
  for (const summary of summaries) {
    for (const point of asTrend(summary.activity_trend)) {
      byDate.set(point.date, [...(byDate.get(point.date) ?? []), point]);
    }
  }
  return [...byDate.entries()].map(([date, points]) => ({
    accuracy: calculateAverage(points.map((point) => point.accuracy)),
    date,
    questionCount: points.reduce((sum, point) => sum + point.questionCount, 0),
  }));
}

function buildTeacherComparison(summaries: readonly TeacherClassSummaryRow[]) {
  const byTeacher = new Map<string, TeacherClassSummaryRow[]>();
  for (const summary of summaries) {
    byTeacher.set(summary.teacher_id, [
      ...(byTeacher.get(summary.teacher_id) ?? []),
      summary,
    ]);
  }
  return [...byTeacher.entries()]
    .map(([teacherId, rows]) => ({
      accuracy: calculateAverage(rows.map((row) => row.accuracy)),
      teacherId,
    }))
    .sort((a, b) => b.accuracy - a.accuracy);
}
