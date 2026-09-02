import "server-only";

import { randomUUID } from "node:crypto";
import type { User } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getCurrentUser } from "@/lib/auth/session";
import { AssignmentError } from "@/lib/assignment/errors";
import {
  listAssignments,
  listStudentAssignments,
} from "@/lib/assignment/service";
import type { AssignmentRecipientProjection } from "@/lib/learner-convergence/assignment-recipient/domain";
import { ClassroomError } from "@/lib/classroom/errors";
import { listTeacherClasses } from "@/lib/classroom/service";
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
import { loadTeacherDashboardLearnerPopulation } from "@/lib/teacher-dashboard/learner-population";
import {
  teacherDashboardQuerySchema,
  teacherDashboardStudentsQuerySchema,
  type TeacherDashboardQuery,
  type TeacherDashboardStudentsQuery,
} from "@/lib/validation/teacher-dashboard";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];

interface TeacherDashboardAccess {
  readonly membershipStatus: "active" | "invited" | "removed" | "suspended";
  readonly organizationId: string;
  readonly role: "organization_admin" | "organization_owner" | "teacher";
  readonly user: User;
}

type TeacherDashboardOperation =
  | "resolve_trusted_account_context"
  | "load_scoped_classes"
  | "load_learner_population"
  | "load_legacy_metric_population"
  | "get_teacher_report"
  | "load_assignments"
  | "load_assignment_students"
  | "write_teacher_dashboard_audit"
  | "write_teaching_insight_audit";

interface TeacherDashboardDiagnostics {
  readonly actorId?: string;
  readonly correlationId: string;
  readonly operation: TeacherDashboardOperation;
  readonly organizationId?: string;
  readonly queryName?: string;
  readonly table?: string;
}

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return new TeacherDashboardError("service_unavailable");
  if (error.code === "22023") {
    return new TeacherDashboardError("invalid_input", undefined, {
      cause: error,
    });
  }
  if (error.code === "P0002") {
    return new TeacherDashboardError("not_found", undefined, { cause: error });
  }
  if (error.code === "42501") {
    if (error.message?.includes("authentication_required")) {
      return new TeacherDashboardError("not_authenticated", undefined, {
        cause: error,
      });
    }
    if (error.message?.includes("active_organization_required")) {
      return new TeacherDashboardError("organization_required", undefined, {
        cause: error,
      });
    }
    return new TeacherDashboardError("forbidden", undefined, { cause: error });
  }
  return new TeacherDashboardError("service_unavailable", undefined, {
    cause: error,
  });
}

function createMappedTeacherDashboardError(
  code: TeacherDashboardError["code"],
  cause: unknown,
) {
  return new TeacherDashboardError(code, undefined, { cause });
}

function mapOrganizationError(error: OrganizationError): TeacherDashboardError {
  switch (error.code) {
    case "not_authenticated":
      return createMappedTeacherDashboardError("not_authenticated", error);
    case "organization_not_found":
    case "not_member":
      return createMappedTeacherDashboardError("organization_required", error);
    case "forbidden":
      return createMappedTeacherDashboardError("forbidden", error);
    default:
      return createMappedTeacherDashboardError("service_unavailable", error);
  }
}

function mapClassroomError(error: ClassroomError): TeacherDashboardError {
  switch (error.code) {
    case "not_authenticated":
      return createMappedTeacherDashboardError("not_authenticated", error);
    case "organization_required":
      return createMappedTeacherDashboardError("organization_required", error);
    case "not_found":
      return createMappedTeacherDashboardError("not_found", error);
    case "forbidden":
      return createMappedTeacherDashboardError("forbidden", error);
    case "invalid_input":
      return createMappedTeacherDashboardError("invalid_input", error);
    default:
      return createMappedTeacherDashboardError("service_unavailable", error);
  }
}

function mapReportingError(error: ReportingError): TeacherDashboardError {
  switch (error.code) {
    case "not_authenticated":
      return createMappedTeacherDashboardError("not_authenticated", error);
    case "organization_required":
      return createMappedTeacherDashboardError("organization_required", error);
    case "not_found":
      return createMappedTeacherDashboardError("not_found", error);
    case "forbidden":
      return createMappedTeacherDashboardError("forbidden", error);
    case "invalid_input":
      return createMappedTeacherDashboardError("invalid_input", error);
    default:
      return createMappedTeacherDashboardError("service_unavailable", error);
  }
}

function mapAssignmentError(error: AssignmentError): TeacherDashboardError {
  switch (error.code) {
    case "not_authenticated":
      return createMappedTeacherDashboardError("not_authenticated", error);
    case "organization_required":
      return createMappedTeacherDashboardError("organization_required", error);
    case "not_found":
      return createMappedTeacherDashboardError("not_found", error);
    case "forbidden":
      return createMappedTeacherDashboardError("forbidden", error);
    case "invalid_input":
      return createMappedTeacherDashboardError("invalid_input", error);
    default:
      return createMappedTeacherDashboardError("service_unavailable", error);
  }
}

interface SafeErrorDetails {
  readonly cause: SafeErrorDetails | null;
  readonly code: string | null;
  readonly details: string | null;
  readonly hint: string | null;
  readonly message: string;
  readonly name: string;
  readonly stack: string | null;
  readonly status: number | null;
  readonly statusCode: number | null;
}

function readStringProperty(value: unknown, key: string): string | null {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return null;
  }
  const property = value[key as keyof typeof value];
  return typeof property === "string" ? property : null;
}

function readNumberProperty(value: unknown, key: string): number | null {
  if (typeof value !== "object" || value === null || !(key in value)) {
    return null;
  }
  const property = value[key as keyof typeof value];
  return typeof property === "number" ? property : null;
}

function readCause(value: unknown): unknown {
  if (typeof value !== "object" || value === null || !("cause" in value)) {
    return null;
  }
  return value.cause;
}

function getSafeErrorDetails(error: unknown, depth = 0): SafeErrorDetails {
  const cause = depth < 2 ? readCause(error) : null;
  if (error instanceof Error) {
    return {
      cause: cause ? getSafeErrorDetails(cause, depth + 1) : null,
      code: readStringProperty(error, "code"),
      details: readStringProperty(error, "details"),
      hint: readStringProperty(error, "hint"),
      message: error.message,
      name: error.name,
      stack: error.stack ?? null,
      status: readNumberProperty(error, "status"),
      statusCode: readNumberProperty(error, "statusCode"),
    };
  }
  if (typeof error === "object" && error !== null) {
    return {
      cause: cause ? getSafeErrorDetails(cause, depth + 1) : null,
      code: readStringProperty(error, "code"),
      details: readStringProperty(error, "details"),
      hint: readStringProperty(error, "hint"),
      message:
        readStringProperty(error, "message") ?? "Unknown non-error object",
      name: readStringProperty(error, "name") ?? "UnknownErrorObject",
      stack: readStringProperty(error, "stack"),
      status: readNumberProperty(error, "status"),
      statusCode: readNumberProperty(error, "statusCode"),
    };
  }
  return {
    cause: null,
    code: null,
    details: null,
    hint: null,
    message: "Unknown non-error thrown",
    name: "Unknown",
    stack: null,
    status: null,
    statusCode: null,
  };
}

function logTeacherDashboardDiagnostic(
  diagnostics: TeacherDashboardDiagnostics,
  error: unknown,
) {
  const safeError = getSafeErrorDetails(error);
  console.error(
    "[teacher-dashboard] operation failed",
    JSON.stringify({
      actorId: diagnostics.actorId ?? null,
      correlationId: diagnostics.correlationId,
      error: safeError,
      operation: diagnostics.operation,
      organizationId: diagnostics.organizationId ?? null,
      queryName: diagnostics.queryName ?? null,
      table: diagnostics.table ?? null,
    }),
  );
}

function withReference(error: TeacherDashboardError, referenceId: string) {
  return new TeacherDashboardError(
    error.code,
    error.referenceId ?? referenceId,
    { cause: error },
  );
}

async function runTeacherDashboardOperation<T>(
  diagnostics: TeacherDashboardDiagnostics,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    logTeacherDashboardDiagnostic(diagnostics, error);
    if (error instanceof TeacherDashboardError) {
      throw withReference(error, diagnostics.correlationId);
    }
    if (error instanceof ReportingError) {
      throw withReference(mapReportingError(error), diagnostics.correlationId);
    }
    if (error instanceof ClassroomError) {
      throw withReference(mapClassroomError(error), diagnostics.correlationId);
    }
    if (error instanceof AssignmentError) {
      throw withReference(mapAssignmentError(error), diagnostics.correlationId);
    }
    throw new TeacherDashboardError(
      "service_unavailable",
      diagnostics.correlationId,
    );
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
    const role = context.membership.role;
    if (
      role !== "organization_owner" &&
      role !== "organization_admin" &&
      role !== "teacher"
    ) {
      throw new TeacherDashboardError("forbidden");
    }
    return {
      membershipStatus: context.membership.status,
      organizationId: context.organization.id,
      role,
      user,
    };
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
    const classes = await listTeacherClasses();
    const activeClasses = classes.filter(
      (classroom) => classroom.status === "active",
    );
    if (!classId) return activeClasses;
    const classroom = activeClasses.find((entry) => entry.id === classId);
    if (!classroom) throw new ClassroomError("not_found");
    return [classroom];
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
  organizationId: string,
): Promise<readonly StudentPerformance[]> {
  if (classes.length === 0) return Object.freeze([]);
  const supabase = await createClient();
  const { data: enrollments, error: enrollmentError } = await supabase
    .from("class_enrollments")
    .select("student_id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .in(
      "class_id",
      classes.map((classroom) => classroom.id),
    )
    .order("student_id", { ascending: true });
  if (enrollmentError) throw mapDatabaseError(enrollmentError);
  const studentIds = new Set<string>();
  for (const enrollment of enrollments) {
    studentIds.add(enrollment.student_id);
  }

  const reports = await Promise.all(
    [...studentIds]
      .sort()
      .map(
        async (legacyStudentId, index): Promise<StudentPerformance | null> => {
          const report = await getStudentReport({
            studentId: legacyStudentId,
          }).catch((error: unknown) => {
            if (error instanceof ReportingError && error.code === "not_found") {
              return null;
            }
            throw error;
          });
          if (!report) return null;
          return Object.freeze({
            accuracy: report.overallAccuracy,
            activityCount: report.learningTrend.reduce(
              (sum, point) => sum + point.questionCount,
              0,
            ),
            masterySummary: report.masterySummary,
            metricReference: `metric-${index + 1}`,
            rank: 0,
            studentId: null,
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
  assignmentStudents: readonly AssignmentRecipientProjection[],
): AssignmentStatusSummary {
  const assignmentIds = new Set(assignments.map((assignment) => assignment.id));
  const scoped = assignmentStudents.filter((student) =>
    assignmentIds.has(student.assignment_id),
  );
  return Object.freeze({
    inProgress: scoped.filter(
      (student) => student.recipient_status === "in_progress",
    ).length,
    overdue: scoped.filter((student) => student.recipient_status === "overdue")
      .length,
    pending: scoped.filter(
      (student) => student.recipient_status === "not_started",
    ).length,
    submitted: scoped.filter(
      (student) => student.recipient_status === "submitted",
    ).length,
  });
}

function buildClassPerformance(
  classes: readonly ClassRow[],
  reports: readonly TeacherReportViewModel[],
  classLearnerCounts: ReadonlyMap<string, number>,
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
        learnerCount: classLearnerCounts.get(classroom.id) ?? 0,
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
      aggregated.set(student.metricReference, {
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
  const correlationId = randomUUID();
  const access = await runTeacherDashboardOperation(
    {
      correlationId,
      operation: "resolve_trusted_account_context",
      queryName: "requireOrganizationRole",
    },
    requireTeacherDashboardAccess,
  );
  const classes = await runTeacherDashboardOperation(
    {
      actorId: access.user.id,
      correlationId,
      operation: "load_scoped_classes",
      organizationId: access.organizationId,
      queryName: "listTeacherClasses",
      table: "classes",
    },
    () => loadScopedClasses(parsed.data.classId),
  );
  const reports = await runTeacherDashboardOperation(
    {
      actorId: access.user.id,
      correlationId,
      operation: "get_teacher_report",
      organizationId: access.organizationId,
      queryName: "getTeacherReport",
      table: "teacher_class_summary",
    },
    () => loadClassReports(classes),
  );
  const learnerPopulation = await runTeacherDashboardOperation(
    {
      actorId: access.user.id,
      correlationId,
      operation: "load_learner_population",
      organizationId: access.organizationId,
      queryName: "loadTeacherDashboardLearnerPopulation",
      table: "student_class_members,students",
    },
    () =>
      loadTeacherDashboardLearnerPopulation({
        accountId: access.user.id,
        classes,
        correlationId,
        membershipStatus: access.membershipStatus,
        organizationId: access.organizationId,
        role: access.role,
      }),
  );
  const students = await runTeacherDashboardOperation(
    {
      actorId: access.user.id,
      correlationId,
      operation: "load_legacy_metric_population",
      organizationId: access.organizationId,
      queryName: "getStudentReport",
      table: "class_enrollments,student_subject_summary",
    },
    () => loadStudentReports(classes, access.organizationId),
  );
  const assignments = await runTeacherDashboardOperation(
    {
      actorId: access.user.id,
      correlationId,
      operation: "load_assignments",
      organizationId: access.organizationId,
      queryName: "listAssignments",
      table: "assignments",
    },
    listAssignments,
  );
  const assignmentStudents = await runTeacherDashboardOperation(
    {
      actorId: access.user.id,
      correlationId,
      operation: "load_assignment_students",
      organizationId: access.organizationId,
      queryName: "listStudentAssignments",
      table: "assignment_students",
    },
    listStudentAssignments,
  );
  const classPerformance = buildClassPerformance(
    classes,
    reports,
    learnerPopulation.classLearnerCounts,
  );
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
    rosterLearners: learnerPopulation.learnerCount,
    studentPerformance,
  });
  const insights = buildTeachingInsights({
    classPerformance,
    weakKnowledge,
  });

  try {
    await runTeacherDashboardOperation(
      {
        actorId: access.user.id,
        correlationId,
        operation: "write_teacher_dashboard_audit",
        organizationId: access.organizationId,
        queryName: "insertTeacherDashboardAudit",
        table: "teacher_dashboard_audit_events",
      },
      () =>
        writeTeacherDashboardAudit({
          action: "TEACHER_DASHBOARD_VIEWED",
          actorId: access.user.id,
          metadata: {
            classCount: classes.length,
            learnerPopulationCount: learnerPopulation.learnerCount,
            scopedClassId: parsed.data.classId ?? null,
          },
          organizationId: access.organizationId,
        }),
    );
  } catch (error: unknown) {
    if (!(error instanceof TeacherDashboardError)) throw error;
  }

  return Object.freeze({
    assignmentStatus,
    classPerformance,
    generatedAt: new Date().toISOString(),
    insights,
    learnerPopulation: learnerPopulation.entries,
    learnerPopulationCount: learnerPopulation.learnerCount,
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
  const accessCorrelationId = randomUUID();
  const access = await runTeacherDashboardOperation(
    {
      correlationId: accessCorrelationId,
      operation: "resolve_trusted_account_context",
      queryName: "requireOrganizationRole",
    },
    requireTeacherDashboardAccess,
  );
  const dashboard = await buildTeacherDashboard(input);
  const correlationId = randomUUID();
  try {
    await runTeacherDashboardOperation(
      {
        actorId: access.user.id,
        correlationId,
        operation: "write_teaching_insight_audit",
        organizationId: access.organizationId,
        queryName: "insertTeachingInsightAudit",
        table: "teacher_dashboard_audit_events",
      },
      () =>
        writeTeacherDashboardAudit({
          action: "TEACHING_INSIGHT_VIEWED",
          actorId: access.user.id,
          metadata: { insightCount: dashboard.insights.length },
          organizationId: access.organizationId,
        }),
    );
  } catch (error: unknown) {
    if (!(error instanceof TeacherDashboardError)) throw error;
  }
  return dashboard.insights;
}
