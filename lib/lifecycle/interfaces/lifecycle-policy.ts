import type {
  LifecyclePolicyEvaluation,
  LifecyclePolicyResult,
} from "@/lib/lifecycle/domain/policy";

export interface LifecyclePolicy {
  evaluate(input: LifecyclePolicyEvaluation): LifecyclePolicyResult;
}
