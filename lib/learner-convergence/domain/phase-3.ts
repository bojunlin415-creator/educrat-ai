import type {
  CanonicalEnrollmentStatus,
  CanonicalEnrollmentRecord,
  LegacyEnrollmentRecord,
} from "@/lib/learner-convergence/domain/model";

export const LEARNER_BACKFILL_CLASSIFICATIONS = [
  "DETERMINISTIC_VERIFIED",
  "MANAGED_ACCOUNTLESS",
  "AMBIGUOUS",
  "NO_VALID_CANDIDATE",
  "CROSS_TENANT_INVALID",
] as const;

export type LearnerBackfillClassification =
  (typeof LEARNER_BACKFILL_CLASSIFICATIONS)[number];

export const AUTHORITATIVE_IDENTITY_EVIDENCE_KINDS = [
  "verified_operator_selection",
  "trusted_existing_mapping",
  "verified_account_claim",
  "trusted_membership_relationship",
  "repository_identity_reference",
] as const;

export type AuthoritativeIdentityEvidenceKind =
  (typeof AUTHORITATIVE_IDENTITY_EVIDENCE_KINDS)[number];

export interface AuthoritativeIdentityEvidence {
  readonly accountId: string;
  readonly kind: AuthoritativeIdentityEvidenceKind;
  readonly organizationId: string;
  readonly referenceId: string;
  readonly studentId: string;
}

export interface ManagedAccountlessEvidence {
  readonly kind: "managed_accountless_marker";
  readonly organizationId: string;
  readonly referenceId: string;
  readonly studentId: string;
}

export interface ActiveLearnerLink {
  readonly accountId: string;
  readonly linkId: string;
  readonly organizationId: string;
  readonly studentId: string;
}

export interface LearnerBackfillCandidate {
  readonly candidateAccountId: string | null;
  readonly canonicalStudentId: string;
  readonly correlationId: string;
  readonly evidence: readonly (
    AuthoritativeIdentityEvidence | ManagedAccountlessEvidence
  )[];
  readonly existingActiveLinks: readonly ActiveLearnerLink[];
  readonly organizationId: string;
}

export type LearnerBackfillReasonCode =
  | "authoritative_identity_verified"
  | "competing_identity_authority"
  | "cross_tenant_identity_evidence"
  | "managed_accountless_evidence"
  | "missing_authoritative_identity_evidence";

export interface LearnerBackfillCandidateResult {
  readonly candidateAccountId: string | null;
  readonly canonicalStudentId: string;
  readonly classification: LearnerBackfillClassification;
  readonly correlationId: string;
  readonly organizationId: string;
  readonly proposedAction: "CREATE_ACTIVE_LINK" | "NONE";
  readonly reasonCode: LearnerBackfillReasonCode;
}

export interface LearnerBackfillPlan {
  readonly candidates: readonly LearnerBackfillCandidateResult[];
  readonly safeToExecute: boolean;
  readonly summary: Readonly<
    Record<
      | "ambiguous"
      | "cross_tenant_invalid"
      | "deterministic_verified"
      | "managed_accountless"
      | "no_valid_candidate",
      number
    >
  >;
}

export type AccountLinkBackfillResult = Readonly<{
  accountId: string;
  correlationId: string;
  linkId: string | null;
  organizationId: string;
  outcome: "created" | "idempotent" | "blocked";
  reasonCode: "created" | "already_linked" | "active_link_conflict";
  studentId: string;
}>;

export const ENROLLMENT_PARITY_CLASSIFICATIONS = [
  "PARITY_MATCH",
  "LEGACY_ONLY",
  "CANONICAL_ONLY",
  "STATUS_MISMATCH",
  "TENANT_MISMATCH",
  "IDENTITY_UNRESOLVED",
] as const;

export type EnrollmentParityClassification =
  (typeof ENROLLMENT_PARITY_CLASSIFICATIONS)[number];

export type CanonicalOnlyEnrollmentReview =
  | "expected_managed_accountless"
  | "deterministic_legacy_equivalent"
  | "identity_unresolved"
  | "tenant_mismatch"
  | "invalid_data";

export interface EnrollmentParityInput {
  readonly authoritativeLinks: readonly ActiveLearnerLink[];
  readonly canonicalEnrollments: readonly CanonicalEnrollmentRecord[];
  readonly legacyEnrollments: readonly LegacyEnrollmentRecord[];
  readonly managedAccountlessStudentIds: readonly string[];
  readonly organizationId: string;
}

export interface EnrollmentParityItem {
  readonly accountId: string | null;
  readonly canonicalMembershipId: string | null;
  readonly canonicalOnlyReview: CanonicalOnlyEnrollmentReview | null;
  readonly canonicalStatus: CanonicalEnrollmentStatus | null;
  readonly classId: string;
  readonly classification: EnrollmentParityClassification;
  readonly legacyEnrollmentId: string | null;
  readonly legacyStatus: LegacyEnrollmentRecord["status"] | null;
  readonly organizationId: string;
  readonly studentId: string | null;
}

export interface EnrollmentParityPlan {
  readonly items: readonly EnrollmentParityItem[];
  readonly summary: Readonly<
    Record<
      | "canonical_only"
      | "identity_unresolved"
      | "legacy_only"
      | "parity_match"
      | "status_mismatch"
      | "tenant_mismatch",
      number
    >
  >;
}

export type EnrollmentBackfillResult = Readonly<{
  canonicalMembershipId: string | null;
  correlationId: string;
  legacyEnrollmentId: string;
  outcome: "created" | "idempotent" | "blocked";
  reasonCode: "created" | "already_exists" | "enrollment_conflict";
}>;
