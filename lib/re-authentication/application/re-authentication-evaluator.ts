import type { ReAuthenticationRegistry } from "@/lib/re-authentication/application/re-authentication-registry";
import {
  ReAuthenticationError,
  type ReAuthenticationErrorCode,
} from "@/lib/re-authentication/domain/error";
import {
  createAllowedReAuthenticationDecision,
  createDeniedReAuthenticationDecision,
  type ReAuthenticationDecision,
  type ReAuthenticationDecisionReason,
  type ReAuthenticationDenialCode,
} from "@/lib/re-authentication/domain/result";
import {
  validateReAuthenticationEvaluationInput,
  validateReAuthenticationPolicyResult,
} from "@/lib/re-authentication/domain/validation";
import type { ReAuthenticationPolicy } from "@/lib/re-authentication/interfaces/re-authentication-policy";

export interface ReAuthenticationEvaluatorDependencies {
  readonly policy: ReAuthenticationPolicy;
  readonly registry: ReAuthenticationRegistry;
}

const VALIDATION_DENIALS: Readonly<
  Record<
    ReAuthenticationErrorCode,
    readonly [ReAuthenticationDenialCode, ReAuthenticationDecisionReason]
  >
> = Object.freeze({
  DUPLICATE_REAUTHENTICATION_ACTION: [
    "INVALID_REQUIREMENT",
    "REAUTHENTICATION_REQUIREMENT_INVALID",
  ],
  DUPLICATE_REAUTHENTICATION_CHALLENGE_TYPE: [
    "INVALID_REQUIREMENT",
    "REAUTHENTICATION_REQUIREMENT_INVALID",
  ],
  DUPLICATE_REAUTHENTICATION_REQUIREMENT: [
    "INVALID_REQUIREMENT",
    "REAUTHENTICATION_REQUIREMENT_INVALID",
  ],
  INVALID_REAUTHENTICATION_CHALLENGE: [
    "INVALID_CHALLENGE",
    "REAUTHENTICATION_CHALLENGE_INVALID",
  ],
  INVALID_REAUTHENTICATION_INPUT: [
    "INVALID_REQUEST",
    "INVALID_REAUTHENTICATION_REQUEST",
  ],
  INVALID_REAUTHENTICATION_POLICY_RESULT: [
    "POLICY_ERROR",
    "REAUTHENTICATION_POLICY_EVALUATION_FAILED",
  ],
  INVALID_REAUTHENTICATION_REQUIREMENT: [
    "INVALID_REQUIREMENT",
    "REAUTHENTICATION_REQUIREMENT_INVALID",
  ],
  UNKNOWN_REAUTHENTICATION_ACTION: [
    "UNKNOWN_ACTION",
    "REAUTHENTICATION_ACTION_NOT_REGISTERED",
  ],
  UNKNOWN_REAUTHENTICATION_CHALLENGE_TYPE: [
    "UNKNOWN_CHALLENGE_TYPE",
    "REAUTHENTICATION_CHALLENGE_TYPE_NOT_REGISTERED",
  ],
  UNSUPPORTED_REAUTHENTICATION_VERSION: [
    "UNSUPPORTED_VERSION",
    "REAUTHENTICATION_VERSION_NOT_SUPPORTED",
  ],
});

function denyFromError(error: ReAuthenticationError): ReAuthenticationDecision {
  const [denialCode, reason] = VALIDATION_DENIALS[error.code];
  return createDeniedReAuthenticationDecision(denialCode, reason);
}

export function evaluateReAuthentication(
  input: unknown,
  dependencies: ReAuthenticationEvaluatorDependencies,
): ReAuthenticationDecision {
  let validated: ReturnType<typeof validateReAuthenticationEvaluationInput>;
  try {
    validated = validateReAuthenticationEvaluationInput(
      input,
      dependencies.registry.definition,
    );
  } catch (error) {
    if (error instanceof ReAuthenticationError) return denyFromError(error);
    return createDeniedReAuthenticationDecision(
      "INVALID_REQUEST",
      "INVALID_REAUTHENTICATION_REQUEST",
    );
  }

  try {
    const policyResult = validateReAuthenticationPolicyResult(
      dependencies.policy.evaluate(validated),
    );
    if (policyResult.decision === "DENY") {
      return createDeniedReAuthenticationDecision(
        "POLICY_DENIED",
        policyResult.reason,
      );
    }
  } catch {
    return createDeniedReAuthenticationDecision(
      "POLICY_ERROR",
      "REAUTHENTICATION_POLICY_EVALUATION_FAILED",
    );
  }

  const challengeRequired =
    validated.requirement.required && validated.challenge === undefined;
  const challengeStatus = !validated.requirement.required
    ? "NOT_REQUIRED"
    : validated.challenge === undefined
      ? "REQUIRED"
      : "VALID";

  return createAllowedReAuthenticationDecision({
    challengeRequired,
    challengeStatus,
    challengeType: validated.requirement.challengeType,
    metadata: validated.requirement.metadata,
    required: validated.requirement.required,
    riskLevel: validated.requirement.riskLevel,
  });
}
