import type {
  DependencyPolicyEvaluation,
  DependencyPolicyResult,
} from "@/lib/dependency/domain/policy";

export interface DependencyPolicy {
  evaluate(input: DependencyPolicyEvaluation): DependencyPolicyResult;
}
