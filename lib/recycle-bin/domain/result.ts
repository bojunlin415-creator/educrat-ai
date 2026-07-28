import type { RecycleBinEvaluation } from "@/lib/recycle-bin/domain/evaluation";

export const RECYCLE_BIN_BLOCKED_REASONS = [
  "DEPENDENCY_BLOCKED",
  "INVALID_ENTRY",
  "INVALID_POLICY_OUTPUT",
  "INVALID_REQUEST",
  "LEGAL_HOLD_BLOCKED",
  "NOT_PURGE_ELIGIBLE",
  "NOT_RESTORABLE",
  "POLICY_DENIED",
  "POLICY_ERROR",
  "RETENTION_BLOCKED",
  "UNKNOWN_RESOURCE",
  "UNKNOWN_TRANSITION",
  "UNSUPPORTED_VERSION",
] as const;

export type RecycleBinBlockedReason =
  (typeof RECYCLE_BIN_BLOCKED_REASONS)[number];

export const RECYCLE_BIN_DECISION_REASONS = [
  "RECYCLE_BIN_RESTORE_ALLOWED",
  "RECYCLE_BIN_PERMANENT_DELETION_ALLOWED",
  "RECYCLE_BIN_ENTRY_INVALID",
  "RECYCLE_BIN_REQUEST_INVALID",
  "RECYCLE_BIN_POLICY_OUTPUT_INVALID",
  "RECYCLE_BIN_POLICY_DENIED",
  "RECYCLE_BIN_POLICY_EVALUATION_FAILED",
  "RECYCLE_BIN_RESOURCE_NOT_REGISTERED",
  "RECYCLE_BIN_TRANSITION_NOT_REGISTERED",
  "RECYCLE_BIN_VERSION_NOT_SUPPORTED",
  "RECYCLE_BIN_RESTORE_NOT_ELIGIBLE",
  "RECYCLE_BIN_PERMANENT_DELETE_NOT_ELIGIBLE",
  "RECYCLE_BIN_RETENTION_NOT_SATISFIED",
  "RECYCLE_BIN_DEPENDENCY_NOT_SATISFIED",
  "RECYCLE_BIN_LEGAL_HOLD_ACTIVE",
] as const;

export type RecycleBinDecisionReason =
  (typeof RECYCLE_BIN_DECISION_REASONS)[number];

export interface RecycleBinRequiredAction {
  readonly action: RecycleBinBlockedReason;
}

export interface RestoreDecision {
  readonly allowed: boolean;
  readonly reason: RecycleBinDecisionReason;
  readonly requiredActions: readonly RecycleBinRequiredAction[];
  readonly version: 1;
}

export interface PermanentDeletionDecision {
  readonly allowed: boolean;
  readonly reason: RecycleBinDecisionReason;
  readonly requiredActions: readonly RecycleBinRequiredAction[];
  readonly version: 1;
}

export interface PurgeEligibility {
  readonly blockedReasons: readonly RecycleBinBlockedReason[];
  readonly eligible: boolean;
  readonly evaluation: RecycleBinEvaluation;
}

export type RecycleBinDecision = RestoreDecision | PermanentDeletionDecision;

function freezeRequiredActions(
  requiredActions: readonly RecycleBinBlockedReason[],
): readonly RecycleBinRequiredAction[] {
  return Object.freeze(
    requiredActions.map((action) => Object.freeze({ action })),
  );
}

export function createRestoreDecision(input: {
  readonly allowed: boolean;
  readonly reason: RecycleBinDecisionReason;
  readonly requiredActions?: readonly RecycleBinBlockedReason[];
}): RestoreDecision {
  return Object.freeze({
    allowed: input.allowed,
    reason: input.reason,
    requiredActions: freezeRequiredActions(input.requiredActions ?? []),
    version: 1,
  });
}

export function createPermanentDeletionDecision(input: {
  readonly allowed: boolean;
  readonly reason: RecycleBinDecisionReason;
  readonly requiredActions?: readonly RecycleBinBlockedReason[];
}): PermanentDeletionDecision {
  return Object.freeze({
    allowed: input.allowed,
    reason: input.reason,
    requiredActions: freezeRequiredActions(input.requiredActions ?? []),
    version: 1,
  });
}

export function createPurgeEligibility(input: {
  readonly blockedReasons: readonly RecycleBinBlockedReason[];
  readonly dependencyCheck: RecycleBinEvaluation["dependencyCheck"];
  readonly eligible: boolean;
  readonly retentionCheck: RecycleBinEvaluation["retentionCheck"];
}): PurgeEligibility {
  return Object.freeze({
    blockedReasons: Object.freeze([...input.blockedReasons]),
    eligible: input.eligible,
    evaluation: Object.freeze({
      dependencyCheck: input.dependencyCheck,
      policyDecision: "ALLOW",
      retentionCheck: input.retentionCheck,
      validation: "PASSED",
    }),
  });
}
