import type { ValidatedReAuthenticationEvaluationInput } from "@/lib/re-authentication/domain/evaluation-input";

export const REAUTHENTICATION_POLICY_DENIAL_REASONS = [
  "REAUTHENTICATION_POLICY_DENIED",
] as const;

export type ReAuthenticationPolicyDenialReason =
  (typeof REAUTHENTICATION_POLICY_DENIAL_REASONS)[number];

export type ReAuthenticationPolicyResult =
  | { readonly decision: "ALLOW" }
  | {
      readonly decision: "DENY";
      readonly reason: ReAuthenticationPolicyDenialReason;
    };

export interface ReAuthenticationPolicy {
  evaluate(
    input: ValidatedReAuthenticationEvaluationInput,
  ): ReAuthenticationPolicyResult;
}
