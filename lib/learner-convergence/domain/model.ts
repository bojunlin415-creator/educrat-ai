export const LEARNER_CONVERGENCE_VERSION = "le-001.v1" as const;

export const LEARNER_DISCREPANCY_CODES = [
  "profile_without_canonical_student",
  "canonical_student_without_account_link",
  "managed_student_without_account",
  "ambiguous_account_student_match",
  "legacy_enrollment_without_canonical",
  "canonical_enrollment_without_legacy",
  "enrollment_status_mismatch",
  "cross_tenant_identity_mismatch",
  "orphan_assignment_recipient",
  "orphan_submission_owner",
  "orphan_learning_event",
  "orphan_mastery_record",
  "orphan_guardian_relationship",
  "parent_portal_legacy_identity_dependency",
] as const;

export type LearnerDiscrepancyCode = (typeof LEARNER_DISCREPANCY_CODES)[number];

export type LearnerDiscrepancySeverity =
  "critical" | "informational" | "warning";

export type LegacyEnrollmentStatus = "active" | "inactive" | "left";
export type CanonicalEnrollmentStatus = "active" | "left";
export type StudentAccountLinkStatus =
  "active" | "expired" | "pending" | "revoked";

export interface EligibleProfileStudentRecord {
  readonly accountId: string;
  readonly organizationId: string;
  readonly status: "active" | "invited" | "removed" | "suspended";
}

export interface CanonicalStudentRecord {
  readonly accountAccessMode:
    "link_expected" | "managed_accountless" | "unspecified";
  readonly organizationId: string;
  readonly status: "active" | "archived";
  readonly studentId: string;
}

export interface StudentAccountLinkRecord {
  readonly accountId: string;
  readonly linkId: string;
  readonly organizationId: string;
  readonly status: StudentAccountLinkStatus;
  readonly studentId: string;
  readonly validFrom: string;
  readonly validTo: string | null;
}

export interface LegacyEnrollmentRecord {
  readonly accountId: string;
  readonly classId: string;
  readonly enrollmentId: string;
  readonly organizationId: string;
  readonly status: LegacyEnrollmentStatus;
}

export interface CanonicalEnrollmentRecord {
  readonly classId: string;
  readonly membershipId: string;
  readonly organizationId: string;
  readonly status: CanonicalEnrollmentStatus;
  readonly studentId: string;
}

export interface AssignmentRecipientRecord {
  readonly accountId: string;
  readonly assignmentId: string;
  readonly organizationId: string;
}

export interface SubmissionOwnerRecord {
  readonly accountId: string;
  readonly assignmentId: string;
  readonly organizationId: string;
  readonly submissionId: string;
}

export interface LearningEventLearnerRecord {
  readonly accountId: string;
  readonly eventId: string;
  readonly organizationId: string;
}

export interface MasteryLearnerRecord {
  readonly accountId: string;
  readonly organizationId: string;
  readonly recordId: string;
  readonly recordType: "knowledge_mastery" | "subject_summary";
}

export interface GuardianLearnerRecord {
  readonly legacyStudentAccountId: string;
  readonly organizationId: string;
  readonly relationshipId: string;
  readonly status: string;
}

export interface LearnerParitySnapshot {
  readonly accountLinks: readonly StudentAccountLinkRecord[];
  readonly assignmentRecipients: readonly AssignmentRecipientRecord[];
  readonly asOf: string;
  readonly canonicalEnrollments: readonly CanonicalEnrollmentRecord[];
  readonly canonicalStudents: readonly CanonicalStudentRecord[];
  readonly eligibleProfileStudents: readonly EligibleProfileStudentRecord[];
  readonly guardianRelationships: readonly GuardianLearnerRecord[];
  readonly learningEvents: readonly LearningEventLearnerRecord[];
  readonly legacyEnrollments: readonly LegacyEnrollmentRecord[];
  readonly masteryRecords: readonly MasteryLearnerRecord[];
  readonly organizationId: string;
  readonly submissions: readonly SubmissionOwnerRecord[];
  readonly version: typeof LEARNER_CONVERGENCE_VERSION;
}

export interface LearnerDiscrepancy {
  readonly code: LearnerDiscrepancyCode;
  readonly organizationId: string;
  readonly relatedIds: readonly string[];
  readonly severity: LearnerDiscrepancySeverity;
  readonly subjectId: string;
  readonly subjectType:
    | "account"
    | "assignment_recipient"
    | "canonical_enrollment"
    | "guardian_relationship"
    | "learning_event"
    | "legacy_enrollment"
    | "mastery_record"
    | "student"
    | "submission";
}

export interface LearnerParitySummary {
  readonly ambiguous_links: number;
  readonly canonical_active_enrollments: number;
  readonly canonical_only_enrollments: number;
  readonly canonical_students: number;
  readonly cross_tenant_mismatch_count: number;
  readonly eligible_profile_students: number;
  readonly enrollment_parity_rate: number;
  readonly legacy_active_enrollments: number;
  readonly legacy_only_enrollments: number;
  readonly linked_profile_students: number;
  readonly managed_students_without_account: number;
  readonly orphan_assignment_count: number;
  readonly orphan_guardian_count: number;
  readonly orphan_learning_event_count: number;
  readonly orphan_submission_count: number;
  readonly status_mismatch_count: number;
}

export interface LearnerParityReport {
  readonly discrepancies: readonly LearnerDiscrepancy[];
  readonly organizationId: string;
  readonly summary: Readonly<LearnerParitySummary>;
  readonly version: typeof LEARNER_CONVERGENCE_VERSION;
}

export type CanonicalStudentResolution =
  | Readonly<{
      linkId: string;
      organizationId: string;
      outcome: "linked";
      studentId: string;
    }>
  | Readonly<{
      outcome:
        | "ambiguous_link"
        | "expired_link"
        | "inactive_context"
        | "no_link"
        | "revoked_link"
        | "wrong_organization";
    }>;
