import type { RecycleBinRegistry } from "@/lib/recycle-bin/application/recycle-bin-registry";
import type { RecycleEntry } from "@/lib/recycle-bin/domain/entry";
import {
  RecycleBinError,
  type RecycleBinErrorCode,
} from "@/lib/recycle-bin/domain/error";
import type { RecycleBinPolicy } from "@/lib/recycle-bin/interfaces/recycle-bin-policy";
import type {
  PermanentDeletionRequest,
  RestoreRequest,
} from "@/lib/recycle-bin/domain/request";
import {
  createPermanentDeletionDecision,
  createPurgeEligibility,
  createRestoreDecision,
  type PermanentDeletionDecision,
  type RecycleBinBlockedReason,
  type RecycleBinDecisionReason,
  type RestoreDecision,
} from "@/lib/recycle-bin/domain/result";
import {
  validatePermanentDeletionRequest,
  validateRecycleBinPolicyResult,
  validateRecycleEntry,
  validateRestoreRequest,
} from "@/lib/recycle-bin/domain/validation";

export interface RecycleBinEvaluatorDependencies {
  readonly policy: RecycleBinPolicy;
  readonly registry: RecycleBinRegistry;
}

const VALIDATION_REASONS: Readonly<
  Record<
    RecycleBinErrorCode,
    readonly [RecycleBinBlockedReason, RecycleBinDecisionReason]
  >
> = Object.freeze({
  DUPLICATE_RECYCLE_BIN_RESOURCE_TYPE: [
    "INVALID_ENTRY",
    "RECYCLE_BIN_ENTRY_INVALID",
  ],
  DUPLICATE_RECYCLE_BIN_TRANSITION: [
    "INVALID_REQUEST",
    "RECYCLE_BIN_REQUEST_INVALID",
  ],
  INVALID_RECYCLE_BIN_ENTRY: ["INVALID_ENTRY", "RECYCLE_BIN_ENTRY_INVALID"],
  INVALID_RECYCLE_BIN_INPUT: ["INVALID_REQUEST", "RECYCLE_BIN_REQUEST_INVALID"],
  INVALID_RECYCLE_BIN_POLICY_OUTPUT: [
    "INVALID_POLICY_OUTPUT",
    "RECYCLE_BIN_POLICY_OUTPUT_INVALID",
  ],
  INVALID_RECYCLE_BIN_REQUEST: [
    "INVALID_REQUEST",
    "RECYCLE_BIN_REQUEST_INVALID",
  ],
  UNKNOWN_RECYCLE_BIN_RESOURCE: [
    "UNKNOWN_RESOURCE",
    "RECYCLE_BIN_RESOURCE_NOT_REGISTERED",
  ],
  UNKNOWN_RECYCLE_BIN_TRANSITION: [
    "UNKNOWN_TRANSITION",
    "RECYCLE_BIN_TRANSITION_NOT_REGISTERED",
  ],
  UNSUPPORTED_RECYCLE_BIN_VERSION: [
    "UNSUPPORTED_VERSION",
    "RECYCLE_BIN_VERSION_NOT_SUPPORTED",
  ],
});

function restoreDeniedFromError(error: RecycleBinError): RestoreDecision {
  const [blockedReason, reason] = VALIDATION_REASONS[error.code];
  return createRestoreDecision({
    allowed: false,
    reason,
    requiredActions: [blockedReason],
  });
}

function permanentDeniedFromError(
  error: RecycleBinError,
): PermanentDeletionDecision {
  const [blockedReason, reason] = VALIDATION_REASONS[error.code];
  return createPermanentDeletionDecision({
    allowed: false,
    reason,
    requiredActions: [blockedReason],
  });
}

function validateEntryMatchesRequest(
  entry: RecycleEntry,
  request: RestoreRequest | PermanentDeletionRequest,
): void {
  if (
    entry.resourceType !== request.resourceType ||
    entry.resourceId !== request.resourceId
  ) {
    throw new RecycleBinError("INVALID_RECYCLE_BIN_REQUEST");
  }
}

export function evaluateRestore(
  input: { readonly entry: unknown; readonly request: unknown },
  dependencies: RecycleBinEvaluatorDependencies,
): RestoreDecision {
  let entry: RecycleEntry;
  let request: RestoreRequest;
  try {
    entry = validateRecycleEntry(input.entry, dependencies.registry.definition);
    request = validateRestoreRequest(
      input.request,
      dependencies.registry.definition,
    );
    validateEntryMatchesRequest(entry, request);
  } catch (error) {
    if (error instanceof RecycleBinError) return restoreDeniedFromError(error);
    return createRestoreDecision({
      allowed: false,
      reason: "RECYCLE_BIN_REQUEST_INVALID",
      requiredActions: ["INVALID_REQUEST"],
    });
  }

  if (!entry.restoreEligible) {
    return createRestoreDecision({
      allowed: false,
      reason: "RECYCLE_BIN_RESTORE_NOT_ELIGIBLE",
      requiredActions: ["NOT_RESTORABLE"],
    });
  }

  try {
    const policyResult = validateRecycleBinPolicyResult(
      dependencies.policy.evaluateRestore({ entry, request }),
    );
    if (policyResult.decision === "DENY") {
      return createRestoreDecision({
        allowed: false,
        reason: policyResult.reason,
        requiredActions: ["POLICY_DENIED"],
      });
    }
  } catch {
    return createRestoreDecision({
      allowed: false,
      reason: "RECYCLE_BIN_POLICY_EVALUATION_FAILED",
      requiredActions: ["POLICY_ERROR"],
    });
  }

  return createRestoreDecision({
    allowed: true,
    reason: "RECYCLE_BIN_RESTORE_ALLOWED",
  });
}

export function evaluatePermanentDeletion(
  input: { readonly entry: unknown; readonly request: unknown },
  dependencies: RecycleBinEvaluatorDependencies,
): PermanentDeletionDecision {
  let entry: RecycleEntry;
  let request: PermanentDeletionRequest;
  try {
    entry = validateRecycleEntry(input.entry, dependencies.registry.definition);
    request = validatePermanentDeletionRequest(
      input.request,
      dependencies.registry.definition,
    );
    validateEntryMatchesRequest(entry, request);
  } catch (error) {
    if (error instanceof RecycleBinError) {
      return permanentDeniedFromError(error);
    }
    return createPermanentDeletionDecision({
      allowed: false,
      reason: "RECYCLE_BIN_REQUEST_INVALID",
      requiredActions: ["INVALID_REQUEST"],
    });
  }

  const blockedReasons: RecycleBinBlockedReason[] = [];
  if (!entry.permanentDeleteEligible) {
    blockedReasons.push("NOT_PURGE_ELIGIBLE");
  }
  if (entry.retentionUntil !== entry.deletedAt) {
    blockedReasons.push("RETENTION_BLOCKED");
  }
  if (entry.dependencyReference !== "NONE") {
    blockedReasons.push("DEPENDENCY_BLOCKED");
  }
  if (entry.legalHoldReference !== "NONE") {
    blockedReasons.push("LEGAL_HOLD_BLOCKED");
  }
  const purgeEligibility = createPurgeEligibility({
    blockedReasons,
    dependencyCheck: blockedReasons.includes("DEPENDENCY_BLOCKED")
      ? "BLOCKED"
      : "PASSED",
    eligible: blockedReasons.length === 0,
    retentionCheck: blockedReasons.includes("RETENTION_BLOCKED")
      ? "BLOCKED"
      : "PASSED",
  });
  if (!purgeEligibility.eligible) {
    return createPermanentDeletionDecision({
      allowed: false,
      reason: blockedReasons.includes("RETENTION_BLOCKED")
        ? "RECYCLE_BIN_RETENTION_NOT_SATISFIED"
        : blockedReasons.includes("DEPENDENCY_BLOCKED")
          ? "RECYCLE_BIN_DEPENDENCY_NOT_SATISFIED"
          : blockedReasons.includes("LEGAL_HOLD_BLOCKED")
            ? "RECYCLE_BIN_LEGAL_HOLD_ACTIVE"
            : "RECYCLE_BIN_PERMANENT_DELETE_NOT_ELIGIBLE",
      requiredActions: purgeEligibility.blockedReasons,
    });
  }

  try {
    const policyResult = validateRecycleBinPolicyResult(
      dependencies.policy.evaluatePermanentDeletion({ entry, request }),
    );
    if (policyResult.decision === "DENY") {
      return createPermanentDeletionDecision({
        allowed: false,
        reason: policyResult.reason,
        requiredActions: ["POLICY_DENIED"],
      });
    }
  } catch {
    return createPermanentDeletionDecision({
      allowed: false,
      reason: "RECYCLE_BIN_POLICY_EVALUATION_FAILED",
      requiredActions: ["POLICY_ERROR"],
    });
  }

  return createPermanentDeletionDecision({
    allowed: true,
    reason: "RECYCLE_BIN_PERMANENT_DELETION_ALLOWED",
  });
}
