import {
  createAllowedLifecycleDecision,
  createDeniedLifecycleDecision,
  type LifecycleDecision,
  type LifecycleDecisionReason,
} from "@/lib/lifecycle/domain/decision";
import {
  LifecycleError,
  type LifecycleErrorCode,
} from "@/lib/lifecycle/domain/error";
import {
  isLifecycleIntent,
  validateLifecycleEvaluationRequest,
  validateLifecyclePolicyResult,
} from "@/lib/lifecycle/domain/validation";
import type { LifecyclePolicy } from "@/lib/lifecycle/interfaces/lifecycle-policy";
import type { LifecycleRegistry } from "@/lib/lifecycle/application/lifecycle-registry";

export interface LifecycleEvaluatorDependencies {
  readonly policy: LifecyclePolicy;
  readonly registry: LifecycleRegistry;
}

const VALIDATION_DENIALS: Readonly<
  Record<
    LifecycleErrorCode,
    readonly [
      Parameters<typeof createDeniedLifecycleDecision>[0],
      LifecycleDecisionReason,
    ]
  >
> = Object.freeze({
  DUPLICATE_LIFECYCLE_DEFINITION: [
    "INVALID_REQUEST",
    "INVALID_LIFECYCLE_REQUEST",
  ],
  DUPLICATE_LIFECYCLE_STATE: ["INVALID_REQUEST", "INVALID_LIFECYCLE_REQUEST"],
  DUPLICATE_LIFECYCLE_TRANSITION: [
    "INVALID_REQUEST",
    "INVALID_LIFECYCLE_REQUEST",
  ],
  ILLEGAL_LIFECYCLE_TRANSITION: [
    "ILLEGAL_TRANSITION",
    "LIFECYCLE_TRANSITION_MISMATCH",
  ],
  INVALID_LIFECYCLE_INPUT: ["INVALID_REQUEST", "INVALID_LIFECYCLE_REQUEST"],
  INVALID_LIFECYCLE_POLICY_RESULT: [
    "POLICY_ERROR",
    "LIFECYCLE_POLICY_EVALUATION_FAILED",
  ],
  INVALID_LIFECYCLE_REQUIREMENTS: [
    "INVALID_REQUEST",
    "INVALID_LIFECYCLE_REQUEST",
  ],
  TERMINAL_STATE_HAS_OUTGOING_TRANSITION: [
    "TERMINAL_STATE",
    "TERMINAL_STATE_REJECTS_TRANSITION",
  ],
  UNKNOWN_LIFECYCLE_DEFINITION: [
    "UNKNOWN_DEFINITION",
    "LIFECYCLE_DEFINITION_NOT_FOUND",
  ],
  UNKNOWN_LIFECYCLE_INTENT: [
    "UNKNOWN_INTENT",
    "LIFECYCLE_INTENT_NOT_SUPPORTED",
  ],
  UNKNOWN_LIFECYCLE_STATE: ["UNKNOWN_STATE", "LIFECYCLE_STATE_NOT_FOUND"],
  UNKNOWN_LIFECYCLE_TRANSITION: [
    "UNKNOWN_TRANSITION",
    "LIFECYCLE_TRANSITION_NOT_FOUND",
  ],
  UNSUPPORTED_LIFECYCLE_VERSION: [
    "UNSUPPORTED_VERSION",
    "LIFECYCLE_VERSION_NOT_SUPPORTED",
  ],
});

function denyFromError(error: LifecycleError): LifecycleDecision {
  const [denialCode, reason] = VALIDATION_DENIALS[error.code];
  return createDeniedLifecycleDecision(denialCode, reason);
}

export function evaluateLifecycleTransition(
  input: unknown,
  dependencies: LifecycleEvaluatorDependencies,
): LifecycleDecision {
  try {
    const request = validateLifecycleEvaluationRequest(input);
    const definition = dependencies.registry.getDefinition(
      request.definitionId,
      request.version,
    );
    if (!definition) {
      return createDeniedLifecycleDecision(
        "UNKNOWN_DEFINITION",
        "LIFECYCLE_DEFINITION_NOT_FOUND",
      );
    }

    const currentState = dependencies.registry.getState(
      definition,
      request.currentStateId,
    );
    const targetState = dependencies.registry.getState(
      definition,
      request.targetStateId,
    );
    if (!currentState || !targetState) {
      return createDeniedLifecycleDecision(
        "UNKNOWN_STATE",
        "LIFECYCLE_STATE_NOT_FOUND",
      );
    }
    if (currentState.isTerminal) {
      return createDeniedLifecycleDecision(
        "TERMINAL_STATE",
        "TERMINAL_STATE_REJECTS_TRANSITION",
      );
    }

    const transition = dependencies.registry.getTransition(
      definition,
      request.transitionId,
    );
    if (!transition) {
      return createDeniedLifecycleDecision(
        "UNKNOWN_TRANSITION",
        "LIFECYCLE_TRANSITION_NOT_FOUND",
      );
    }
    if (
      transition.from !== currentState.id ||
      transition.to !== targetState.id ||
      transition.intent !== request.intent ||
      !isLifecycleIntent(request.intent)
    ) {
      return createDeniedLifecycleDecision(
        "ILLEGAL_TRANSITION",
        "LIFECYCLE_TRANSITION_MISMATCH",
      );
    }

    let policyResult: ReturnType<LifecyclePolicy["evaluate"]>;
    try {
      policyResult = validateLifecyclePolicyResult(
        dependencies.policy.evaluate({
          currentState,
          definition,
          targetState,
          transition,
        }),
      );
    } catch {
      return createDeniedLifecycleDecision(
        "POLICY_ERROR",
        "LIFECYCLE_POLICY_EVALUATION_FAILED",
      );
    }
    if (policyResult.decision === "DENY") {
      return createDeniedLifecycleDecision(
        "POLICY_DENIED",
        policyResult.reason,
      );
    }

    return createAllowedLifecycleDecision(
      currentState,
      targetState,
      transition,
    );
  } catch (error) {
    if (error instanceof LifecycleError) return denyFromError(error);
    return createDeniedLifecycleDecision(
      "POLICY_ERROR",
      "LIFECYCLE_POLICY_EVALUATION_FAILED",
    );
  }
}
