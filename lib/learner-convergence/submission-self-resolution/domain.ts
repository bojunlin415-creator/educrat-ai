import type { CanonicalStudentResolution } from "@/lib/learner-convergence/domain/model";
import type { AssignmentRecipientProjection } from "@/lib/learner-convergence/assignment-recipient/domain";
import type { LearnerCutoverControlMode } from "@/lib/learner-convergence/cutover/domain";

export const SUBMISSION_SELF_RESOLUTION_VERSION =
  "le-001.submission-self-resolution.v1" as const;

export type SubmissionSelfResolutionErrorCode =
  | "assignment_recipient_not_found"
  | "cross_tenant_forbidden"
  | "student_account_link_expired"
  | "student_account_link_inactive"
  | "student_account_link_missing"
  | "student_identity_conflict"
  | "submission_identity_unavailable";

export class SubmissionSelfResolutionError extends Error {
  readonly code: SubmissionSelfResolutionErrorCode;

  constructor(code: SubmissionSelfResolutionErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "SubmissionSelfResolutionError";
    this.code = code;
  }
}

export interface CanonicalSubmissionIdentity {
  readonly linkId: string;
  readonly organizationId: string;
  readonly studentId: string;
}

export type SubmissionSelfReadAuthority = "CANONICAL" | "LEGACY";
export type SubmissionSelfWriteAuthority = "CANONICAL" | "LEGACY";

export type SubmissionSelfSourceFailure =
  "IDENTITY" | "INTEGRITY" | "RUNTIME" | "SECURITY";

export class SubmissionSelfSourceError extends Error {
  readonly failure: SubmissionSelfSourceFailure;

  constructor(failure: SubmissionSelfSourceFailure, options?: ErrorOptions) {
    super(`submission_self_source_${failure.toLowerCase()}`, options);
    this.name = "SubmissionSelfSourceError";
    this.failure = failure;
  }
}

export interface SubmissionSelfAuthorityEvent {
  readonly action: "READ" | "SAVE" | "SUBMIT";
  readonly assignmentId: string | null;
  readonly canonicalOnlyCount: number;
  readonly canonicalSelfResolutionSuccess: number;
  readonly correlationId: string;
  readonly fallbackCount: number;
  readonly legacyOnlyCount: number;
  readonly legacySelfResolutionSuccess: number;
  readonly linkState: "ACTIVE" | "EXPIRED" | "INACTIVE" | "MISSING" | "UNKNOWN";
  readonly matchedIdentityCount: number;
  readonly mode: LearnerCutoverControlMode;
  readonly organizationId: string;
  readonly recipientFound: boolean;
  readonly recipientMismatch: number;
  readonly returnedAuthority: SubmissionSelfReadAuthority;
  readonly shadowErrorCount: number;
  readonly tenantMismatch: number;
  readonly unexpectedIdentityConflict: number;
  readonly version: typeof SUBMISSION_SELF_RESOLUTION_VERSION;
  readonly writeFallbackCount: 0;
}

export interface SubmissionSelfAuthorityObserver {
  record(event: SubmissionSelfAuthorityEvent): void;
}

export interface SubmissionSelfRecipientSource {
  loadCanonical(): Promise<readonly AssignmentRecipientProjection[]>;
  loadLegacy(): Promise<readonly AssignmentRecipientProjection[]>;
}

export interface SubmissionSelfReadResult {
  readonly fallbackUsed: boolean;
  readonly recipients: readonly AssignmentRecipientProjection[];
  readonly returnedAuthority: SubmissionSelfReadAuthority;
  readonly shadowErrorCount: number;
  readonly version: typeof SUBMISSION_SELF_RESOLUTION_VERSION;
}

export type CanonicalResolutionInput = CanonicalStudentResolution;
