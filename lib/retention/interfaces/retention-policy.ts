import type {
  RetentionPolicyEvaluation,
  RetentionPolicyResult,
} from "@/lib/retention/domain/policy";

export interface RetentionPolicy {
  evaluate(input: RetentionPolicyEvaluation): RetentionPolicyResult;
}
