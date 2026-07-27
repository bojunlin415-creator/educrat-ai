import type {
  RetentionCategory,
  RetentionMetadataCode,
} from "@/lib/retention/shared/references";
import type {
  RetentionMetadataEntry,
  RetentionPeriod,
} from "@/lib/retention/domain/definition";
import type { RetentionEvaluation } from "@/lib/retention/domain/evaluation";

export const RETENTION_DENIAL_CODES = [
  "INVALID_REQUEST",
  "UNKNOWN_RESOURCE",
  "UNKNOWN_CATEGORY",
  "UNKNOWN_TRANSITION",
  "UNSUPPORTED_VERSION",
  "INVALID_RULE",
  "INVALID_HOLD",
  "LEGAL_HOLD_ACTIVE",
  "POLICY_DENIED",
  "POLICY_ERROR",
] as const;

export type RetentionDenialCode = (typeof RETENTION_DENIAL_CODES)[number];

export const RETENTION_DECISION_REASONS = [
  "RETENTION_CHECK_ALLOWED",
  "INVALID_RETENTION_REQUEST",
  "RETENTION_RESOURCE_NOT_REGISTERED",
  "RETENTION_CATEGORY_NOT_REGISTERED",
  "RETENTION_TRANSITION_NOT_REGISTERED",
  "RETENTION_VERSION_NOT_SUPPORTED",
  "RETENTION_RULE_INVALID",
  "LEGAL_HOLD_INVALID",
  "LEGAL_HOLD_IS_ACTIVE",
  "RETENTION_POLICY_DENIED",
  "RETENTION_POLICY_EVALUATION_FAILED",
] as const;

export type RetentionDecisionReason =
  (typeof RETENTION_DECISION_REASONS)[number];

export interface RetentionRequirements {
  readonly legalHoldCheck: "PASSED" | "NOT_APPLICABLE";
  readonly metadata: readonly RetentionMetadataEntry[];
  readonly minimumRetentionPeriod: RetentionPeriod;
  readonly retentionCategory: RetentionCategory;
}

export interface AllowedRetentionDecision {
  readonly decision: "ALLOWED";
  readonly evaluation: RetentionEvaluation;
  readonly requirements: RetentionRequirements;
}

export interface DeniedRetentionDecision {
  readonly decision: "DENIED";
  readonly denialCode: RetentionDenialCode;
  readonly reason: RetentionDecisionReason;
}

export type RetentionDecision =
  AllowedRetentionDecision | DeniedRetentionDecision;

function copyMetadata(
  metadata: readonly RetentionMetadataEntry[],
): readonly RetentionMetadataEntry[] {
  return Object.freeze(
    metadata.map((entry) =>
      Object.freeze({
        key: entry.key as RetentionMetadataCode,
        value: entry.value,
      }),
    ),
  );
}

export function createAllowedRetentionDecision(input: {
  readonly legalHoldCount: number;
  readonly legalHoldSupported: boolean;
  readonly metadata: readonly RetentionMetadataEntry[];
  readonly minimumRetentionPeriod: RetentionPeriod;
  readonly retentionCategory: RetentionCategory;
}): AllowedRetentionDecision {
  const requirements: RetentionRequirements = Object.freeze({
    legalHoldCheck: input.legalHoldSupported ? "PASSED" : "NOT_APPLICABLE",
    metadata: copyMetadata(input.metadata),
    minimumRetentionPeriod: Object.freeze({
      amount: input.minimumRetentionPeriod.amount,
      unit: input.minimumRetentionPeriod.unit,
    }),
    retentionCategory: input.retentionCategory,
  });
  const evaluation: RetentionEvaluation = Object.freeze({
    activeLegalHoldCount: 0,
    legalHoldCount: input.legalHoldCount,
    policyDecision: "ALLOW",
    validation: "PASSED",
  });

  return Object.freeze({
    decision: "ALLOWED",
    evaluation,
    requirements,
  });
}

export function createDeniedRetentionDecision(
  denialCode: RetentionDenialCode,
  reason: RetentionDecisionReason,
): DeniedRetentionDecision {
  return Object.freeze({ decision: "DENIED", denialCode, reason });
}
