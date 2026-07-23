import type { DependencyRegistry } from "@/lib/dependency/application/dependency-registry";
import {
  DependencyError,
  type DependencyErrorCode,
} from "@/lib/dependency/domain/error";
import {
  createAllowedDependencyCheckResult,
  createDeniedDependencyCheckResult,
  type DependencyCheckResult,
  type DependencyDecisionReason,
  type DependencyDenialCode,
} from "@/lib/dependency/domain/result";
import type { DependencyReference } from "@/lib/dependency/domain/model";
import type { DependencyCheckRequest } from "@/lib/dependency/domain/request";
import {
  validateDependencyCheckRequest,
  validateDependencyPolicyResult,
  validateDependencyReferences,
} from "@/lib/dependency/domain/validation";
import type { DependencyGraph } from "@/lib/dependency/interfaces/dependency-graph";
import type { DependencyPolicy } from "@/lib/dependency/interfaces/dependency-policy";

export interface DependencyEvaluatorDependencies {
  readonly graph: DependencyGraph;
  readonly policy: DependencyPolicy;
  readonly registry: DependencyRegistry;
}

const VALIDATION_DENIALS: Readonly<
  Record<
    DependencyErrorCode,
    readonly [DependencyDenialCode, DependencyDecisionReason]
  >
> = Object.freeze({
  CIRCULAR_DEPENDENCY: ["CIRCULAR_DEPENDENCY", "CIRCULAR_DEPENDENCY_DETECTED"],
  DISCONNECTED_DEPENDENCY_GRAPH: [
    "UNKNOWN_DEPENDENCY",
    "DISCONNECTED_DEPENDENCY_GRAPH",
  ],
  DUPLICATE_DEPENDENCY_REFERENCE: [
    "DUPLICATE_DEPENDENCY",
    "DUPLICATE_DEPENDENCY_DETECTED",
  ],
  DUPLICATE_DEPENDENCY_RESOURCE_TYPE: [
    "INVALID_REQUEST",
    "INVALID_DEPENDENCY_REQUEST",
  ],
  DUPLICATE_DEPENDENCY_TRANSITION: [
    "INVALID_REQUEST",
    "INVALID_DEPENDENCY_REQUEST",
  ],
  DUPLICATE_DEPENDENCY_TYPE: ["INVALID_REQUEST", "INVALID_DEPENDENCY_REQUEST"],
  INVALID_DEPENDENCY_GRAPH_RESULT: [
    "GRAPH_ERROR",
    "DEPENDENCY_GRAPH_RESULT_INVALID",
  ],
  INVALID_DEPENDENCY_INPUT: ["INVALID_REQUEST", "INVALID_DEPENDENCY_REQUEST"],
  INVALID_DEPENDENCY_POLICY_RESULT: [
    "POLICY_ERROR",
    "DEPENDENCY_POLICY_EVALUATION_FAILED",
  ],
  UNKNOWN_DEPENDENCY_RESOURCE: [
    "UNKNOWN_RESOURCE",
    "DEPENDENCY_RESOURCE_NOT_REGISTERED",
  ],
  UNKNOWN_DEPENDENCY_TRANSITION: [
    "UNKNOWN_TRANSITION",
    "DEPENDENCY_TRANSITION_NOT_REGISTERED",
  ],
  UNKNOWN_DEPENDENCY_TYPE: [
    "UNKNOWN_DEPENDENCY",
    "DEPENDENCY_TYPE_NOT_REGISTERED",
  ],
  UNSUPPORTED_DEPENDENCY_VERSION: [
    "UNSUPPORTED_VERSION",
    "DEPENDENCY_VERSION_NOT_SUPPORTED",
  ],
});

function denyFromError(error: DependencyError): DependencyCheckResult {
  const [denialCode, reason] = VALIDATION_DENIALS[error.code];
  return createDeniedDependencyCheckResult(denialCode, reason);
}

export async function evaluateDependencyProtection(
  input: unknown,
  dependencies: DependencyEvaluatorDependencies,
): Promise<DependencyCheckResult> {
  let request: DependencyCheckRequest;
  try {
    request = validateDependencyCheckRequest(
      input,
      dependencies.registry.definition,
    );
  } catch (error) {
    if (error instanceof DependencyError) return denyFromError(error);
    return createDeniedDependencyCheckResult(
      "INVALID_REQUEST",
      "INVALID_DEPENDENCY_REQUEST",
    );
  }

  let graphResult: readonly unknown[];
  try {
    graphResult = await dependencies.graph.findDependencies(request);
  } catch {
    return createDeniedDependencyCheckResult(
      "GRAPH_ERROR",
      "DEPENDENCY_GRAPH_LOOKUP_FAILED",
    );
  }

  let references: readonly DependencyReference[];
  try {
    references = validateDependencyReferences(
      graphResult,
      request,
      dependencies.registry.definition,
    );
  } catch (error) {
    if (error instanceof DependencyError) return denyFromError(error);
    return createDeniedDependencyCheckResult(
      "GRAPH_ERROR",
      "DEPENDENCY_GRAPH_RESULT_INVALID",
    );
  }

  try {
    const policyResult = validateDependencyPolicyResult(
      dependencies.policy.evaluate({ dependencies: references, request }),
    );
    if (policyResult.decision === "DENY") {
      return createDeniedDependencyCheckResult(
        "POLICY_DENIED",
        policyResult.reason,
      );
    }
  } catch {
    return createDeniedDependencyCheckResult(
      "POLICY_ERROR",
      "DEPENDENCY_POLICY_EVALUATION_FAILED",
    );
  }

  return createAllowedDependencyCheckResult(references);
}
