import type { LearnerCutoverControlMode } from "@/lib/learner-convergence/cutover/domain";

export const ASSIGNMENT_CLASS_EXPANSION_VERSION =
  "le-001.assignment-class-expansion.v1" as const;

export type AssignmentClassExpansionActorRole =
  "organization_admin" | "organization_owner" | "teacher";

export interface AssignmentClassExpansionCandidate {
  readonly canonicalStudentId: string | null;
  readonly classId: string;
  readonly legacyRecipientId: string | null;
  readonly membershipId: string;
  readonly organizationId: string;
  readonly source: "CANONICAL" | "LEGACY";
}

export interface AssignmentClassExpansionSource {
  loadCanonical(): Promise<readonly AssignmentClassExpansionCandidate[]>;
  loadLegacy(): Promise<readonly AssignmentClassExpansionCandidate[]>;
}

export interface AssignmentRecipientCompatibilityReference {
  readonly canonicalStudentId: string;
  readonly legacyRecipientId: string;
}

export interface AssignmentRecipientCompatibilityResult {
  readonly expectedAccountlessStudentIds: readonly string[];
  readonly references: readonly AssignmentRecipientCompatibilityReference[];
}

export interface AssignmentRecipientCompatibilityResolver {
  resolve(
    canonicalStudentIds: readonly string[],
  ): Promise<AssignmentRecipientCompatibilityResult>;
}

export interface ExpandedAssignmentLearnerCandidate {
  readonly canonicalStudentId: string | null;
  readonly classIds: readonly string[];
  readonly legacyRecipientId: string | null;
  readonly membershipIds: readonly string[];
  readonly organizationId: string;
  readonly source: "CANONICAL" | "LEGACY";
}

export interface AssignmentClassExpansionReadResult {
  readonly authority: "CANONICAL" | "LEGACY";
  readonly candidates: readonly ExpandedAssignmentLearnerCandidate[];
  readonly canonicalCandidateCount: number | null;
  readonly compatibilityMappedCount: number;
  readonly expectedAccountlessCandidateCount: number;
  readonly fallbackUsed: boolean;
  readonly identityUnresolvedCount: number;
  readonly legacyCandidateCount: number | null;
  readonly legacyRecipientIds: readonly string[];
  readonly mode: LearnerCutoverControlMode;
  readonly shadowErrorCount: number;
  readonly version: typeof ASSIGNMENT_CLASS_EXPANSION_VERSION;
}

export interface AssignmentClassExpansionAuthorityEvent {
  readonly actorRole: AssignmentClassExpansionActorRole;
  readonly assignmentId: string | null;
  readonly canonicalCandidateCount: number | null;
  readonly classCount: number;
  readonly compatibilityMappedCount: number;
  readonly correlationId: string;
  readonly expectedAccountlessCandidateCount: number;
  readonly fallbackUsed: boolean;
  readonly identityUnresolvedCount: number;
  readonly legacyCandidateCount: number | null;
  readonly mode: LearnerCutoverControlMode;
  readonly organizationId: string;
  readonly returnedAuthority: "CANONICAL" | "LEGACY";
  readonly shadowErrorCount: number;
  readonly version: typeof ASSIGNMENT_CLASS_EXPANSION_VERSION;
}

export interface AssignmentClassExpansionAuthorityObserver {
  record(event: AssignmentClassExpansionAuthorityEvent): void;
}

export interface AssignmentClassExpansionParityMetrics {
  readonly canonicalCandidateCount: number;
  readonly compatibilityMappedCount: number;
  readonly expectedCanonicalOnlyCount: number;
  readonly identityUnresolvedCount: number;
  readonly legacyCandidateCount: number;
  readonly legacyOnlyCount: number;
  readonly matchCount: number;
  readonly shadowErrorCount: number;
  readonly statusMismatchCount: number;
  readonly tenantMismatchCount: number;
  readonly unexpectedCanonicalOnlyCount: number;
  readonly version: typeof ASSIGNMENT_CLASS_EXPANSION_VERSION;
}
