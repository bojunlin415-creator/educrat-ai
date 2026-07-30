export const CLASS_STATUSES = ["active", "inactive", "archived"] as const;
export const ENROLLMENT_STATUSES = ["active", "inactive", "left"] as const;

export type ClassStatus = (typeof CLASS_STATUSES)[number];
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export interface ClassAggregate {
  readonly code: string;
  readonly createdAt: string;
  readonly description: string | null;
  readonly grade: string;
  readonly id: string;
  readonly name: string;
  readonly organizationId: string;
  readonly schoolYear: number;
  readonly semester: 1 | 2;
  readonly status: ClassStatus;
  readonly subject: string;
  readonly teacherId: string;
  readonly updatedAt: string;
}

export interface ClassEnrollment {
  readonly classId: string;
  readonly id: string;
  readonly joinedAt: string;
  readonly leftAt: string | null;
  readonly organizationId: string;
  readonly status: EnrollmentStatus;
  readonly studentId: string;
}

export function isClassActive(status: ClassStatus): boolean {
  return status === "active";
}

export function isEnrollmentActive(status: EnrollmentStatus): boolean {
  return status === "active";
}
