import "server-only";

import type { User } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getCurrentUser } from "@/lib/auth/session";
import {
  listAssignments,
  listStudentAssignments,
} from "@/lib/assignment/service";
import { ClassroomError } from "@/lib/classroom/errors";
import { getClass, listTeacherClasses } from "@/lib/classroom/service";
import { OrganizationError } from "@/lib/organization/errors";
import { requireOrganizationRole } from "@/lib/organization/service";
import {
  calculateAverage,
  type TeacherReportViewModel,
} from "@/lib/reporting/domain";
import { ReportingError } from "@/lib/reporting/errors";
import { getStudentReport, getTeacherReport } from "@/lib/reporting/service";
import { createClient } from "@/lib/supabase/server";
import {
  buildStudentRanking,
  buildTeachingInsights,
  buildTodayOverview,
  resolveRiskLevel,
  type AssignmentStatusSummary,
  type ClassPerformance,
  type RecommendationDashboardItem,
  type StudentPerformance,
  type TeacherDashboardViewModel,
  type WeakKnowledgeDashboardItem,
} from "@/lib/teacher-dashboard/domain";
import { TeacherDashboardError } from "@/lib/teacher-dashboard/errors";
import {
  teacherDashboardQuerySchema,
  teacherDashboardStudentsQuerySchema,
  type TeacherDashboardQuery,
  type TeacherDashboardStudentsQuery,
} from "@/lib/validation/teacher-dashboard";

type AssignmentStudentRow =
  Database["public"]["Tables"]["assignment_students"]["Row"];
type ClassRow = Database["public"]["Tables"]["classes"]["Row"];

interface TeacherDashboardAccess {
  readonly organizationId: string;
  readonly user: User;
}

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return new TeacherDashboardError("service_unavailable");
  if (error.code === "22023") return new TeacherDashboardError("invalid_input");
  if (error.code === "P0002") return new TeacherDashboardError("not_found");
  if (error.code === "42501") {
    if (error.message?.includes("authentication_required")) {
      return new TeacherDashboardError("not_authenticated");
    }
    if (error.message?.includes("active_organization_required")) {
      return new TeacherDashboardError("organization_required");
    }
    return new TeacherDashboardError("forbidden");
  }
  return new TeacherDashboardError("service_unavailable");
}

function mapOrganizationError(error: OrganizationError): TeacherDashboardError {
  switch (error.code) {
    case "not_authenticated":
      return new TeacherDashboardError("not_authenticated");
    case "organization_not_found":
    case "not_member":
      return new TeacherDashboardError("organization_required");
    case "forbidden":
      return new TeacherDashboardError("forbidden");
    default:
      return new TeacherDashboardError("service_unavailable");
  }
}

function mapClassroomError(error: ClassroomError): TeacherDashboardError {
  switch (error.code) {
    case "not_authenticated":
      return new TeacherDashboardError("not_authenticated");
    case "organization_required":
      return new TeacherDashboardError("organization_required");
    case "not_found":
      return new TeacherDashboardError("not_found");
    case "forbidden":
      return new TeacherDashboardError("forbidden");
    case "invalid_input":
      return new TeacherDashboardError("invalid_input");
    default:
      return new TeacherDashboardError("service_unavailable");
  }
}

async function requireTeacherDashboardAccess(): Promise<TeacherDashboardAccess> {
  try {
    const context = await requireOrganizationRole([
      "organization_owner",
      "organization_admin",
      "teacher",
    ]);
    const user = await getCurrentUser();
    if (!user) throw new TeacherDashboardError("not_authenticated");
    return { organizationId: context.organization.id, user };
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

async function writeTeacherDashboardAudit(input: {
  readonly action: "TEACHER_DASHBOARD_VIEWED" | "TEACHING_INSIGHT_VIEWED";
  readonly actorId: string;
  readonly metadata?: Json;
  readonly organizationId: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("teacher_dashboard_audit_events")
    .insert({
      action: input.action,
      actor_id: input.actorId,
      metadata: input.metadata ?? {},
      organization_id: input.organizationId,
    });
  if (error) throw mapDatabaseError(error);
}

async function loadScopedClasses(
  classId?: string,
): Promise<readonly ClassRow[]> {
  try {
    const classes = classId
      ? [await getClass(classId)]
      : await listTeacherClasses();
    return classes.filter((classroom) => classroom.status === "active");
  } catch (error: unknown) {
    if (error instanceof ClassroomError) throw mapClassroomError(error);
    throw error;
  }
}

async function loadClassReports(
  classes: readonly ClassRow[],
): Promise<readonly TeacherReportViewModel[]> {
  return Promise.all(
    classes.map(async (classroom) => {
      try {
        return await getTeacherReport({ classId: classroom.id });
      } catch (error: unknown) {
        if (error instanceof ReportingError && error.code === "not_found") {
          return emptyTeacherReport(classroom.id);
        }
        throw error;
      }
    }),
  );
}

async function loadStudentReports(
  classes: readonly ClassRow[],
): Promise<readonly StudentPerformance[]> {
  const studentIds = new Set<string>();
  for (const classroom of classes) {
    try {
      const detail = await getClass(classroom.id);
      for (const enrollment of detail.enrollments) {
        if (enrollment.status === "active")
          studentIds.add(enrollment.student_id);
      }
    } catch (error: unknown) {
      if (error instanceof ClassroomError) throw mapClassroomError(error);
      throw error;
    }
  }

  const reports = await Promise.all(
    [...studentIds].map(
      async (studentId): Promise<StudentPerformance | null> => {
        const report = await getStudentReport({ studentId }).catch(
          (error: unknown) => {
            if (error instanceof ReportingError && error.code === "not_found") {
              return null;
            }
            throw error;
          },
        );
        if (!report) return null;
        return Object.freeze({
          accuracy: report.overallAccuracy,
          activityCount: report.learningTrend.reduce(
            (sum, point) => sum + point.questionCount,
            0,
          ),
          masterySummary: report.masterySummary,
          rank: 0,
          studentId,
        });
      },
    ),
  );
  return buildStudentRanking(
    reports.filter((report): report is StudentPerformance => Boolean(report)),
    "needs_attention",
  );
}

function emptyTeacherReport(classId: string): TeacherReportViewModel {
  return Object.freeze({
    activityTrend: [],
    assignmentCompletion: {
      assigned: 0,
      submissionRate: 0,
      submitted: 0,
    },
    classAccuracy: 0,
    classId,
    studentRanking: [],
    weakKnowledgeRanking: [],
  });
}

function buildAssignmentStatus(
  assignments: readonly { readonly id: string }[],
  assignmentStudents: readonly AssignmentStudentRow[],
): AssignmentStatusSummary {
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
  const scoped = assignmentStudents.filter((student) =>
    assignmentIds.has(student.assignment_id),
  );
  return Object.freeze({
    inProgress: scoped.filter((student) => student.status === "in_progress")
      .length,
    overdue: scoped.filter((student) => student.status === "overdue").length,
    pending: scoped.filter((student) => student.status === "not_started")
      .length,
    submitted: scoped.filter((student) => student.status === "submitted")
      .length,
  });
}

function buildClassPerformance(
  classes: readonly ClassRow[],
  reports: readonly TeacherReportViewModel[],
): readonly ClassPerformance[] {
  return Object.freeze(
    classes.map((classroom, index) => {
      const report = reports[index];
      return Object.freeze({
        assignmentCompletion: report?.assignmentCompletion ?? {
          assigned: 0,
          submissionRate: 0,
          submitted: 0,
        },
        averageAccuracy: report?.classAccuracy ?? 0,
        classId: classroom.id,
        className: classroom.name,
        knowledgeDistribution: Object.fromEntries(
          (report?.weakKnowledgeRanking ?? []).map((item) => [
            item.knowledgePointId,
            Number((1 - item.accuracy).toFixed(4)),
          ]),
        ),
        learningTrend: report?.activityTrend ?? [],
        masteryDistribution: report?.weakKnowledgeRanking ?? [],
      });
    }),
  );
}

function buildWeakKnowledgeDashboard(
  studentPerformance: readonly StudentPerformance[],
  reports: readonly TeacherReportViewModel[],
): readonly WeakKnowledgeDashboardItem[] {
  const aggregated = new Map<
    string,
    { affectedStudents: number; recommendationCount: number }
  >();
  for (const report of reports) {
    for (const item of report.weakKnowledgeRanking) {
      const previous = aggregated.get(item.knowledgePointId) ?? {
        affectedStudents: 0,
        recommendationCount: 0,
      };
      aggregated.set(item.knowledgePointId, {
        affectedStudents:
          previous.affectedStudents + (item.accuracy < 0.6 ? 1 : 0),
        recommendationCount: previous.recommendationCount + item.attemptCount,
      });
    }
  }
  if (aggregated.size === 0) {
    for (const student of studentPerformance.filter(
      (item) => item.accuracy < 0.6,
    )) {
      aggregated.set(student.studentId, {
        affectedStudents: 1,
        recommendationCount: student.activityCount,
      });
    }
  }
  return Object.freeze(
    [...aggregated.entries()]
      .map(([knowledgePointId, value]) =>
        Object.freeze({
          affectedStudents: value.affectedStudents,
          knowledgePointId,
          recommendationCount: value.recommendationCount,
          riskLevel: resolveRiskLevel(value),
        }),
      )
      .sort(
        (a, b) =>
          b.affectedStudents - a.affectedStudents ||
          b.recommendationCount - a.recommendationCount,
      ),
  );
}

function buildRecommendations(
  weakKnowledge: readonly WeakKnowledgeDashboardItem[],
): readonly RecommendationDashboardItem[] {
  return Object.freeze(
    weakKnowledge.slice(0, 5).map((item) =>
      Object.freeze({
        knowledgePointId: item.knowledgePointId,
        reason:
          item.riskLevel === "high"
            ? "多位學生在此知識點表現不穩，建議優先補救。"
            : "此知識點有持續練習價值，可安排短題組鞏固。",
        recommendedDifficulty:
          item.riskLevel === "high"
            ? "easy"
            : item.riskLevel === "medium"
              ? "normal"
              : "hard",
        recommendedTopic: item.knowledgePointId,
        recommendedWorksheet:
          item.riskLevel === "high" ? "補救練習卷" : "混合練習卷",
      }),
    ),
  );
}

async function buildTeacherDashboard(
  input: TeacherDashboardQuery = {},
): Promise<TeacherDashboardViewModel> {
  const parsed = teacherDashboardQuerySchema.safeParse(input);
  if (!parsed.success) throw new TeacherDashboardError("invalid_input");
  const access = await requireTeacherDashboardAccess();
  const classes = await loadScopedClasses(parsed.data.classId);
  const [reports, students, assignments, assignmentStudents] =
    await Promise.all([
      loadClassReports(classes),
      loadStudentReports(classes),
      listAssignments(),
      listStudentAssignments(),
    ]);
  const classPerformance = buildClassPerformance(classes, reports);
  const studentPerformance = buildStudentRanking(students, "needs_attention");
  const assignmentStatus = buildAssignmentStatus(
    assignments,
    assignmentStudents,
  );
  const weakKnowledge = buildWeakKnowledgeDashboard(
    studentPerformance,
    reports,
  );
  const recommendations = buildRecommendations(weakKnowledge);
  const learningTrend = classPerformance.flatMap((item) => item.learningTrend);
  const todayOverview = buildTodayOverview({
    assignmentStatus,
    averageAccuracy: calculateAverage(
      classPerformance.map((item) => item.averageAccuracy),
    ),
    learningTrend,
    studentPerformance,
  });
  const insights = buildTeachingInsights({
    classPerformance,
    weakKnowledge,
  });

  await writeTeacherDashboardAudit({
    action: "TEACHER_DASHBOARD_VIEWED",
    actorId: access.user.id,
    metadata: {
      classCount: classes.length,
      scopedClassId: parsed.data.classId ?? null,
    },
    organizationId: access.organizationId,
  });

  return Object.freeze({
    assignmentStatus,
    classPerformance,
    generatedAt: new Date().toISOString(),
    insights,
    recommendations,
    studentPerformance,
    todayOverview,
    weakKnowledge,
  });
}

export async function getTeacherDashboard(
  input: TeacherDashboardQuery = {},
): Promise<TeacherDashboardViewModel> {
  return buildTeacherDashboard(input);
}

export async function getTeacherDashboardClasses(
  input: TeacherDashboardQuery = {},
) {
  return (await buildTeacherDashboard(input)).classPerformance;
}

export async function getTeacherDashboardStudents(
  input: TeacherDashboardStudentsQuery = {},
) {
  const parsed = teacherDashboardStudentsQuerySchema.safeParse(input);
  if (!parsed.success) throw new TeacherDashboardError("invalid_input");
  const dashboard = await buildTeacherDashboard({
    classId: parsed.data.classId,
  });
  return buildStudentRanking(
    dashboard.studentPerformance,
    parsed.data.ranking ?? "needs_attention",
  );
}

export async function getTeacherDashboardInsights(
  input: TeacherDashboardQuery = {},
) {
  const access = await requireTeacherDashboardAccess();
  const dashboard = await buildTeacherDashboard(input);
  await writeTeacherDashboardAudit({
    action: "TEACHING_INSIGHT_VIEWED",
    actorId: access.user.id,
    metadata: { insightCount: dashboard.insights.length },
    organizationId: access.organizationId,
  });
  return dashboard.insights;
}
