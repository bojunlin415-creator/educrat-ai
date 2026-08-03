import "server-only";

import type { User } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getCurrentUser } from "@/lib/auth/session";
import { OrganizationError } from "@/lib/organization/errors";
import { requireOrganizationMembership } from "@/lib/organization/service";
import {
  buildParentInsights,
  buildParentProgressSummary,
  buildStrengths,
  mapRecommendationsForParent,
  mapWeakKnowledgeForParent,
  type ParentAssignmentSummary,
  type ParentPortalChild,
  type ParentPortalDashboardViewModel,
  type ParentStudentReportViewModel,
} from "@/lib/parent-portal/domain";
import { ParentPortalError } from "@/lib/parent-portal/errors";
import { getStudentReport } from "@/lib/reporting/service";
import { createClient } from "@/lib/supabase/server";
import {
  parentDashboardQuerySchema,
  parentStudentIdSchema,
  type ParentDashboardQuery,
} from "@/lib/validation/parent-portal";

type StudentGuardianRow =
  Database["public"]["Tables"]["student_guardians"]["Row"];
type AssignmentStudentRow =
  Database["public"]["Tables"]["assignment_students"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return new ParentPortalError("service_unavailable");
  if (error.code === "22023") return new ParentPortalError("invalid_input");
  if (error.code === "42501") {
    if (error.message?.includes("authentication_required")) {
      return new ParentPortalError("not_authenticated");
    }
    if (error.message?.includes("active_organization_required")) {
      return new ParentPortalError("organization_required");
    }
    return new ParentPortalError("forbidden");
  }
  return new ParentPortalError("service_unavailable");
}

function mapOrganizationError(error: OrganizationError): ParentPortalError {
  switch (error.code) {
    case "not_authenticated":
      return new ParentPortalError("not_authenticated");
    case "organization_not_found":
    case "not_member":
      return new ParentPortalError("organization_required");
    case "forbidden":
      return new ParentPortalError("forbidden");
    default:
      return new ParentPortalError("service_unavailable");
  }
}

async function requireParentActor(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ParentPortalError("not_authenticated");
  return user;
}

async function requireGuardianContext() {
  try {
    const context = await requireOrganizationMembership();
    if (context.membership.role !== "guardian") {
      throw new ParentPortalError("forbidden");
    }
    return context;
  } catch (error: unknown) {
    if (error instanceof ParentPortalError) throw error;
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

async function writeParentPortalAudit(input: {
  readonly action: "PARENT_DASHBOARD_VIEWED" | "PARENT_STUDENT_REPORT_VIEWED";
  readonly actorId: string;
  readonly metadata?: Json;
  readonly organizationId: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("parent_portal_audit_events").insert({
    action: input.action,
    actor_id: input.actorId,
    metadata: input.metadata ?? {},
    organization_id: input.organizationId,
  });
  if (error) throw mapDatabaseError(error);
}

async function loadGuardianRelationships(input: {
  readonly guardianUserId: string;
  readonly organizationId: string;
}): Promise<readonly StudentGuardianRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_guardians")
    .select("*")
    .eq("organization_id", input.organizationId)
    .eq("guardian_user_id", input.guardianUserId)
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw mapDatabaseError(error);
  return data;
}

async function mapRelationshipsToChildren(
  relationships: readonly StudentGuardianRow[],
): Promise<readonly ParentPortalChild[]> {
  if (relationships.length === 0) return [];
  const supabase = await createClient();
  const studentIds = relationships.map(
    (relationship) => relationship.student_id,
  );
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", studentIds);
  if (error) throw mapDatabaseError(error);
  const names = new Map(
    profiles.map((profile) => [
      profile.id,
      profile.display_name ?? `學生 ${profile.id.slice(0, 8)}`,
    ]),
  );
  return Object.freeze(
    relationships.map((relationship) =>
      Object.freeze({
        displayName:
          names.get(relationship.student_id) ??
          `學生 ${relationship.student_id.slice(0, 8)}`,
        grade: null,
        relationshipType: relationship.relationship_type,
        studentId: relationship.student_id,
        verifiedAt: relationship.verified_at,
      }),
    ),
  );
}

async function requireLinkedChild(studentId: string): Promise<{
  readonly child: ParentPortalChild;
  readonly organizationId: string;
  readonly user: User;
}> {
  const parsed = parentStudentIdSchema.safeParse({ studentId });
  if (!parsed.success) throw new ParentPortalError("invalid_input");
  const context = await requireGuardianContext();
  const user = await requireParentActor();
  const relationships = await loadGuardianRelationships({
    guardianUserId: user.id,
    organizationId: context.organization.id,
  });
  const relationship = relationships.find(
    (candidate) => candidate.student_id === parsed.data.studentId,
  );
  if (!relationship) throw new ParentPortalError("not_found");
  const children = await mapRelationshipsToChildren([relationship]);
  const child = children[0];
  if (!child) throw new ParentPortalError("not_found");
  return { child, organizationId: context.organization.id, user };
}

function summarizeAssignments(
  assignmentStudents: readonly AssignmentStudentRow[],
  assignments: readonly AssignmentRow[],
): ParentAssignmentSummary {
  const assignmentById = new Map(
    assignments.map((assignment) => [assignment.id, assignment]),
  );
  const counts = assignmentStudents.reduce(
    (summary, row) => ({
      inProgress: summary.inProgress + (row.status === "in_progress" ? 1 : 0),
      notStarted: summary.notStarted + (row.status === "not_started" ? 1 : 0),
      overdue: summary.overdue + (row.status === "overdue" ? 1 : 0),
      submitted: summary.submitted + (row.status === "submitted" ? 1 : 0),
    }),
    { inProgress: 0, notStarted: 0, overdue: 0, submitted: 0 },
  );
  return Object.freeze({
    counts: Object.freeze(counts),
    recent: Object.freeze(
      assignmentStudents.slice(0, 5).map((row) => {
        const assignment = assignmentById.get(row.assignment_id);
        return Object.freeze({
          dueAt: assignment?.due_at ?? row.assigned_at,
          status: row.status,
          title: assignment?.title ?? "未命名作業",
        });
      }),
    ),
    total: assignmentStudents.length,
  });
}

export async function getParentAssignmentSummary(
  studentId: string,
): Promise<ParentAssignmentSummary> {
  const { organizationId } = await requireLinkedChild(studentId);
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("assignment_students")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("student_id", studentId)
    .order("assigned_at", { ascending: false })
    .limit(20);
  if (error) throw mapDatabaseError(error);
  if (rows.length === 0) {
    return summarizeAssignments([], []);
  }
  const { data: assignments, error: assignmentError } = await supabase
    .from("assignments")
    .select("*")
    .eq("organization_id", organizationId)
    .in(
      "id",
      rows.map((row) => row.assignment_id),
    );
  if (assignmentError) throw mapDatabaseError(assignmentError);
  return summarizeAssignments(rows, assignments);
}

export async function listParentChildren(): Promise<
  readonly ParentPortalChild[]
> {
  const context = await requireGuardianContext();
  const user = await requireParentActor();
  const relationships = await loadGuardianRelationships({
    guardianUserId: user.id,
    organizationId: context.organization.id,
  });
  return mapRelationshipsToChildren(relationships);
}

export async function getParentStudentReport(
  studentId: string,
): Promise<ParentStudentReportViewModel> {
  const { child, organizationId, user } = await requireLinkedChild(studentId);
  const report = await getStudentReport({ studentId });
  const assignments = await getParentAssignmentSummary(studentId);
  const hasLearningData =
    report.learningTrend.length > 0 ||
    report.weakKnowledge.length > 0 ||
    report.recommendationCount > 0;
  const learningProgress = buildParentProgressSummary({
    hasLearningData,
    masterySummary: report.masterySummary,
    overallAccuracy: report.overallAccuracy,
  });
  const weakKnowledge = mapWeakKnowledgeForParent(report.weakKnowledge);
  const recommendations = mapRecommendationsForParent(
    report.recommendedDifficulty,
  );
  const result = Object.freeze({
    assignments,
    child,
    insights: buildParentInsights({
      assignmentSummary: assignments,
      hasLearningData,
      progress: learningProgress,
      weakKnowledgeCount: weakKnowledge.length,
    }),
    learningProgress,
    recentActivity: Object.freeze(report.learningTrend.slice(-7)),
    recommendations,
    strengths: buildStrengths({
      masterySummary: report.masterySummary,
      overallAccuracy: report.overallAccuracy,
    }),
    weakKnowledge,
  });
  await writeParentPortalAudit({
    action: "PARENT_STUDENT_REPORT_VIEWED",
    actorId: user.id,
    metadata: { report: "parent_student", studentId },
    organizationId,
  });
  return result;
}

export async function getParentRecommendations(
  studentId: string,
): Promise<readonly ReturnType<typeof mapRecommendationsForParent>[number][]> {
  return (await getParentStudentReport(studentId)).recommendations;
}

export async function getParentDashboard(
  input: ParentDashboardQuery = {},
): Promise<ParentPortalDashboardViewModel> {
  const parsed = parentDashboardQuerySchema.safeParse(input);
  if (!parsed.success) throw new ParentPortalError("invalid_input");
  const context = await requireGuardianContext();
  const user = await requireParentActor();
  const children = await listParentChildren();
  const selectedStudentId =
    parsed.data.studentId ?? children.at(0)?.studentId ?? null;
  const selectedReport = selectedStudentId
    ? await getParentStudentReport(selectedStudentId)
    : null;
  await writeParentPortalAudit({
    action: "PARENT_DASHBOARD_VIEWED",
    actorId: user.id,
    metadata: { childCount: children.length, selectedStudentId },
    organizationId: context.organization.id,
  });
  return Object.freeze({ children, selectedReport, selectedStudentId });
}
