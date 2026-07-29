export const ASSIGNMENT_STATUSES = [
  "draft",
  "scheduled",
  "active",
  "cancelled",
  "closed",
] as const;

export const STUDENT_ASSIGNMENT_STATUSES = [
  "not_started",
  "in_progress",
  "submitted",
  "overdue",
] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];
export type StudentAssignmentStatus =
  (typeof STUDENT_ASSIGNMENT_STATUSES)[number];

export interface Assignment {
  readonly assignedBy: string;
  readonly createdAt: string;
  readonly curriculumId: string;
  readonly curriculumVersionId: string;
  readonly description: string | null;
  readonly dueAt: string;
  readonly id: string;
  readonly organizationId: string;
  readonly publishAt: string;
  readonly status: AssignmentStatus;
  readonly title: string;
  readonly updatedAt: string;
}

export interface StudentAssignment {
  readonly assignedAt: string;
  readonly assignmentId: string;
  readonly openedAt: string | null;
  readonly status: StudentAssignmentStatus;
  readonly studentId: string;
  readonly submittedAt: string | null;
}

export interface AssignmentSubmission {
  readonly assignmentId: string;
  readonly content: Record<string, unknown>;
  readonly createdAt: string;
  readonly id: string;
  readonly organizationId: string;
  readonly status: "draft" | "submitted";
  readonly studentId: string;
  readonly submittedAt: string | null;
  readonly updatedAt: string;
}

export function isAssignmentEditable(status: AssignmentStatus): boolean {
  return status === "draft" || status === "scheduled";
}

export function isStudentSubmissionEditable(
  status: StudentAssignmentStatus,
): boolean {
  return status === "not_started" || status === "in_progress";
}
