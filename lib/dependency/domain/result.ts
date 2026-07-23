import type { DependencyEvaluation } from "@/lib/dependency/domain/evaluation";
import type { DependencyReference } from "@/lib/dependency/domain/model";

export const DEPENDENCY_DENIAL_CODES = [
  "INVALID_REQUEST",
  "UNKNOWN_RESOURCE",
  "UNKNOWN_DEPENDENCY",
  "DUPLICATE_DEPENDENCY",
  "CIRCULAR_DEPENDENCY",
  "UNKNOWN_TRANSITION",
  "UNSUPPORTED_VERSION",
  "GRAPH_ERROR",
  "POLICY_DENIED",
  "POLICY_ERROR",
] as const;

export type DependencyDenialCode = (typeof DEPENDENCY_DENIAL_CODES)[number];

export const DEPENDENCY_DECISION_REASONS = [
  "DEPENDENCY_CHECK_ALLOWED",
  "INVALID_DEPENDENCY_REQUEST",
  "DEPENDENCY_RESOURCE_NOT_REGISTERED",
  "DEPENDENCY_TYPE_NOT_REGISTERED",
  "DUPLICATE_DEPENDENCY_DETECTED",
  "CIRCULAR_DEPENDENCY_DETECTED",
  "DISCONNECTED_DEPENDENCY_GRAPH",
  "DEPENDENCY_TRANSITION_NOT_REGISTERED",
  "DEPENDENCY_VERSION_NOT_SUPPORTED",
  "DEPENDENCY_GRAPH_LOOKUP_FAILED",
  "DEPENDENCY_GRAPH_RESULT_INVALID",
  "DEPENDENCY_POLICY_DENIED",
  "DEPENDENCY_POLICY_EVALUATION_FAILED",
] as const;

export type DependencyDecisionReason =
  (typeof DEPENDENCY_DECISION_REASONS)[number];

export interface AllowedDependencyCheckResult {
  readonly decision: "ALLOWED";
  readonly dependencies: readonly DependencyReference[];
  readonly evaluation: DependencyEvaluation;
}

export interface DeniedDependencyCheckResult {
  readonly decision: "DENIED";
  readonly denialCode: DependencyDenialCode;
  readonly reason: DependencyDecisionReason;
}

export type DependencyCheckResult =
  AllowedDependencyCheckResult | DeniedDependencyCheckResult;

export function createAllowedDependencyCheckResult(
  dependencies: readonly DependencyReference[],
): AllowedDependencyCheckResult {
  const evaluation: DependencyEvaluation = Object.freeze({
    dependencyCount: dependencies.length,
    policyDecision: "ALLOW",
    readonlyDependencyCount: dependencies.filter(
      (dependency) => dependency.readonly,
    ).length,
    validation: "PASSED",
  });

  return Object.freeze({
    decision: "ALLOWED",
    dependencies,
    evaluation,
  });
}

export function createDeniedDependencyCheckResult(
  denialCode: DependencyDenialCode,
  reason: DependencyDecisionReason,
): DeniedDependencyCheckResult {
  return Object.freeze({ decision: "DENIED", denialCode, reason });
}
