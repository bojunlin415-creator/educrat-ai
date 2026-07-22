import type { LifecycleRequirements } from "@/lib/lifecycle/domain/requirements";
import type { LifecycleState } from "@/lib/lifecycle/domain/state";
import type { LifecycleTransition } from "@/lib/lifecycle/domain/transition";

export const LIFECYCLE_DENIAL_CODES = [
  "INVALID_REQUEST",
  "UNKNOWN_DEFINITION",
  "UNKNOWN_STATE",
  "UNKNOWN_TRANSITION",
  "UNKNOWN_INTENT",
  "ILLEGAL_TRANSITION",
  "TERMINAL_STATE",
  "UNSUPPORTED_VERSION",
  "POLICY_DENIED",
  "POLICY_ERROR",
] as const;

export type LifecycleDenialCode = (typeof LIFECYCLE_DENIAL_CODES)[number];

export const LIFECYCLE_DECISION_REASONS = [
  "TRANSITION_ALLOWED",
  "INVALID_LIFECYCLE_REQUEST",
  "LIFECYCLE_DEFINITION_NOT_FOUND",
  "LIFECYCLE_STATE_NOT_FOUND",
  "LIFECYCLE_TRANSITION_NOT_FOUND",
  "LIFECYCLE_INTENT_NOT_SUPPORTED",
  "LIFECYCLE_TRANSITION_MISMATCH",
  "TERMINAL_STATE_REJECTS_TRANSITION",
  "LIFECYCLE_VERSION_NOT_SUPPORTED",
  "LIFECYCLE_POLICY_DENIED",
  "LIFECYCLE_POLICY_EVALUATION_FAILED",
] as const;

export type LifecycleDecisionReason =
  (typeof LIFECYCLE_DECISION_REASONS)[number];

export interface AllowedLifecycleDecision {
  readonly currentState: LifecycleState;
  readonly decision: "ALLOWED";
  readonly requirements: LifecycleRequirements;
  readonly targetState: LifecycleState;
  readonly transition: LifecycleTransition;
}

export interface DeniedLifecycleDecision {
  readonly decision: "DENIED";
  readonly denialCode: LifecycleDenialCode;
  readonly reason: LifecycleDecisionReason;
}

export type LifecycleDecision =
  AllowedLifecycleDecision | DeniedLifecycleDecision;

export function createAllowedLifecycleDecision(
  currentState: LifecycleState,
  targetState: LifecycleState,
  transition: LifecycleTransition,
): AllowedLifecycleDecision {
  return Object.freeze({
    currentState,
    decision: "ALLOWED",
    requirements: transition.requirements,
    targetState,
    transition,
  });
}

export function createDeniedLifecycleDecision(
  denialCode: LifecycleDenialCode,
  reason: LifecycleDecisionReason,
): DeniedLifecycleDecision {
  return Object.freeze({ decision: "DENIED", denialCode, reason });
}
