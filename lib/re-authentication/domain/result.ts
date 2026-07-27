import type { ReAuthenticationEvaluation } from "@/lib/re-authentication/domain/evaluation";
import type {
  ReAuthenticationMetadataCode,
  ReAuthenticationChallengeType,
} from "@/lib/re-authentication/shared/references";
import type {
  ReAuthenticationMetadataEntry,
  ReAuthenticationRiskLevel,
} from "@/lib/re-authentication/domain/definition";

export const REAUTHENTICATION_DENIAL_CODES = [
  "INVALID_REQUEST",
  "UNKNOWN_ACTION",
  "UNKNOWN_CHALLENGE_TYPE",
  "UNSUPPORTED_VERSION",
  "INVALID_REQUIREMENT",
  "INVALID_CHALLENGE",
  "POLICY_DENIED",
  "POLICY_ERROR",
] as const;

export type ReAuthenticationDenialCode =
  (typeof REAUTHENTICATION_DENIAL_CODES)[number];

export const REAUTHENTICATION_DECISION_REASONS = [
  "REAUTHENTICATION_ALLOWED",
  "INVALID_REAUTHENTICATION_REQUEST",
  "REAUTHENTICATION_ACTION_NOT_REGISTERED",
  "REAUTHENTICATION_CHALLENGE_TYPE_NOT_REGISTERED",
  "REAUTHENTICATION_VERSION_NOT_SUPPORTED",
  "REAUTHENTICATION_REQUIREMENT_INVALID",
  "REAUTHENTICATION_CHALLENGE_INVALID",
  "REAUTHENTICATION_POLICY_DENIED",
  "REAUTHENTICATION_POLICY_EVALUATION_FAILED",
] as const;

export type ReAuthenticationDecisionReason =
  (typeof REAUTHENTICATION_DECISION_REASONS)[number];

export interface ReAuthenticationRequirements {
  readonly challengeType: ReAuthenticationChallengeType;
  readonly metadata: readonly ReAuthenticationMetadataEntry[];
  readonly required: boolean;
  readonly riskLevel: ReAuthenticationRiskLevel;
}

export interface AllowedReAuthenticationDecision {
  readonly challengeRequired: boolean;
  readonly decision: "ALLOWED";
  readonly evaluation: ReAuthenticationEvaluation;
  readonly requirements: ReAuthenticationRequirements;
}

export interface DeniedReAuthenticationDecision {
  readonly decision: "DENIED";
  readonly denialCode: ReAuthenticationDenialCode;
  readonly reason: ReAuthenticationDecisionReason;
}

export type ReAuthenticationDecision =
  AllowedReAuthenticationDecision | DeniedReAuthenticationDecision;

function copyMetadata(
  metadata: readonly ReAuthenticationMetadataEntry[],
): readonly ReAuthenticationMetadataEntry[] {
  return Object.freeze(
    metadata.map((entry) =>
      Object.freeze({
        key: entry.key as ReAuthenticationMetadataCode,
        value: entry.value,
      }),
    ),
  );
}

export function createAllowedReAuthenticationDecision(input: {
  readonly challengeRequired: boolean;
  readonly challengeStatus: ReAuthenticationEvaluation["challengeStatus"];
  readonly challengeType: ReAuthenticationChallengeType;
  readonly metadata: readonly ReAuthenticationMetadataEntry[];
  readonly required: boolean;
  readonly riskLevel: ReAuthenticationRiskLevel;
}): AllowedReAuthenticationDecision {
  const requirements: ReAuthenticationRequirements = Object.freeze({
    challengeType: input.challengeType,
    metadata: copyMetadata(input.metadata),
    required: input.required,
    riskLevel: input.riskLevel,
  });
  const evaluation: ReAuthenticationEvaluation = Object.freeze({
    challengeStatus: input.challengeStatus,
    policyDecision: "ALLOW",
    validation: "PASSED",
  });

  return Object.freeze({
    challengeRequired: input.challengeRequired,
    decision: "ALLOWED",
    evaluation,
    requirements,
  });
}

export function createDeniedReAuthenticationDecision(
  denialCode: ReAuthenticationDenialCode,
  reason: ReAuthenticationDecisionReason,
): DeniedReAuthenticationDecision {
  return Object.freeze({ decision: "DENIED", denialCode, reason });
}
