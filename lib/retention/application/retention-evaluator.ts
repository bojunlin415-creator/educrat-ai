import type { RetentionRegistry } from "@/lib/retention/application/retention-registry";
import {
  RetentionError,
  type RetentionErrorCode,
} from "@/lib/retention/domain/error";
import {
  createAllowedRetentionDecision,
  createDeniedRetentionDecision,
  type RetentionDecision,
  type RetentionDecisionReason,
  type RetentionDenialCode,
} from "@/lib/retention/domain/result";
import {
  validateRetentionEvaluationInput,
  validateRetentionPolicyResult,
} from "@/lib/retention/domain/validation";
import type { RetentionPolicy } from "@/lib/retention/interfaces/retention-policy";

export interface RetentionEvaluatorDependencies {
  readonly policy: RetentionPolicy;
  readonly registry: RetentionRegistry;
}

const VALIDATION_DENIALS: Readonly<
  Record<
    RetentionErrorCode,
    readonly [RetentionDenialCode, RetentionDecisionReason]
  >
> = Object.freeze({
  DUPLICATE_LEGAL_HOLD: ["INVALID_HOLD", "LEGAL_HOLD_INVALID"],
  DUPLICATE_RETENTION_CATEGORY: ["INVALID_RULE", "RETENTION_RULE_INVALID"],
  DUPLICATE_RETENTION_RESOURCE: ["INVALID_RULE", "RETENTION_RULE_INVALID"],
  DUPLICATE_RETENTION_TRANSITION: ["INVALID_RULE", "RETENTION_RULE_INVALID"],
  INVALID_LEGAL_HOLD: ["INVALID_HOLD", "LEGAL_HOLD_INVALID"],
  INVALID_RETENTION_INPUT: ["INVALID_REQUEST", "INVALID_RETENTION_REQUEST"],
  INVALID_RETENTION_POLICY_RESULT: [
    "POLICY_ERROR",
    "RETENTION_POLICY_EVALUATION_FAILED",
  ],
  INVALID_RETENTION_RULE: ["INVALID_RULE", "RETENTION_RULE_INVALID"],
  UNKNOWN_RETENTION_CATEGORY: [
    "UNKNOWN_CATEGORY",
    "RETENTION_CATEGORY_NOT_REGISTERED",
  ],
  UNKNOWN_RETENTION_RESOURCE: [
    "UNKNOWN_RESOURCE",
    "RETENTION_RESOURCE_NOT_REGISTERED",
  ],
  UNKNOWN_RETENTION_TRANSITION: [
    "UNKNOWN_TRANSITION",
    "RETENTION_TRANSITION_NOT_REGISTERED",
  ],
  UNSUPPORTED_RETENTION_VERSION: [
    "UNSUPPORTED_VERSION",
    "RETENTION_VERSION_NOT_SUPPORTED",
  ],
});

function denyFromError(error: RetentionError): RetentionDecision {
  const [denialCode, reason] = VALIDATION_DENIALS[error.code];
  return createDeniedRetentionDecision(denialCode, reason);
}

export function evaluateRetentionProtection(
  input: unknown,
  dependencies: RetentionEvaluatorDependencies,
): RetentionDecision {
  let validated: ReturnType<typeof validateRetentionEvaluationInput>;
  try {
    validated = validateRetentionEvaluationInput(
      input,
      dependencies.registry.definition,
    );
  } catch (error) {
    if (error instanceof RetentionError) return denyFromError(error);
    return createDeniedRetentionDecision(
      "INVALID_REQUEST",
      "INVALID_RETENTION_REQUEST",
    );
  }

  if (validated.legalHolds.some((hold) => hold.active)) {
    return createDeniedRetentionDecision(
      "LEGAL_HOLD_ACTIVE",
      "LEGAL_HOLD_IS_ACTIVE",
    );
  }

  try {
    const policyResult = validateRetentionPolicyResult(
      dependencies.policy.evaluate(validated),
    );
    if (policyResult.decision === "DENY") {
      return createDeniedRetentionDecision(
        "POLICY_DENIED",
        policyResult.reason,
      );
    }
  } catch {
    return createDeniedRetentionDecision(
      "POLICY_ERROR",
      "RETENTION_POLICY_EVALUATION_FAILED",
    );
  }

  return createAllowedRetentionDecision({
    legalHoldCount: validated.legalHolds.length,
    legalHoldSupported: validated.definition.legalHoldSupported,
    metadata: validated.definition.metadata,
    minimumRetentionPeriod: validated.definition.minimumRetentionPeriod,
    retentionCategory: validated.definition.retentionCategory,
  });
}
