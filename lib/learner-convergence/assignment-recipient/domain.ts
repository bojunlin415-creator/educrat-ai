import type { LearnerCutoverControlMode } from "@/lib/learner-convergence/cutover/domain";

export const ASSIGNMENT_RECIPIENT_AUTHORITY_VERSION =
  "le-001.assignment-recipient.v1" as const;

export type AssignmentRecipientIdentityAuthority =
  | "CANONICAL"
  | "CANONICAL_WITH_LEGACY_COMPATIBILITY"
  | "LEGACY_ONLY_HISTORICAL";

export interface AssignmentRecipientProjection {
  readonly assigned_at: string;
  readonly assignment_id: string;
  readonly canonical_student_id: string | null;
  readonly identity_authority: AssignmentRecipientIdentityAuthority;
  readonly recipient_id: string | null;
  readonly recipient_status:
    "in_progress" | "not_started" | "overdue" | "submitted";
  readonly source_class_ids: readonly string[];
}

export type AssignmentRecipientWriteAuthority =
  "CANONICAL_ONLY" | "CANONICAL_WITH_VERIFIED_LEGACY_PROJECTION" | "LEGACY";

export type AssignmentRecipientSourceFailure =
  "INTEGRITY" | "RUNTIME" | "SECURITY";

export class AssignmentRecipientSourceError extends Error {
  readonly failure: AssignmentRecipientSourceFailure;

  constructor(
    failure: AssignmentRecipientSourceFailure,
    options?: ErrorOptions,
  ) {
    super(`assignment_recipient_source_${failure.toLowerCase()}`, options);
    this.name = "AssignmentRecipientSourceError";
    this.failure = failure;
  }
}

export interface AssignmentRecipientSource {
  loadCanonical(): Promise<readonly AssignmentRecipientProjection[]>;
  loadLegacy(): Promise<readonly AssignmentRecipientProjection[]>;
}

export interface AssignmentRecipientAuthorityResult {
  readonly fallbackUsed: boolean;
  readonly mode: LearnerCutoverControlMode;
  readonly recipients: readonly AssignmentRecipientProjection[];
  readonly returnedAuthority: "CANONICAL" | "LEGACY";
  readonly shadowErrorCount: number;
  readonly version: typeof ASSIGNMENT_RECIPIENT_AUTHORITY_VERSION;
}

export interface AssignmentRecipientAuthorityEvent {
  readonly assignmentId: string;
  readonly canonicalOnlyCount: number;
  readonly canonicalRecipientCount: number;
  readonly compatibilityMappedCount: number;
  readonly correlationId: string;
  readonly fallbackUsed: boolean;
  readonly identityUnresolvedCount: number;
  readonly legacyHistoricalCount: number;
  readonly mode: LearnerCutoverControlMode;
  readonly organizationId: string;
  readonly recipientCount: number;
  readonly returnedAuthority: "CANONICAL" | "LEGACY";
  readonly shadowErrorCount: number;
  readonly version: typeof ASSIGNMENT_RECIPIENT_AUTHORITY_VERSION;
  readonly writeFallbackCount: 0;
}

export interface AssignmentRecipientAuthorityObserver {
  record(event: AssignmentRecipientAuthorityEvent): void;
}
