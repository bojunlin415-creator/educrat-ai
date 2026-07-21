import type { PermissionKey } from "@/lib/authorization/domain/permission";
import type { ResourceScope } from "@/lib/authorization/domain/scope";

export const AUTHORIZATION_DECISIONS = ["ALLOW", "DENY"] as const;

export type AuthorizationDecision = (typeof AUTHORIZATION_DECISIONS)[number];

export const DECISION_REASONS = [
  "PERMISSION_MATCH",
  "ALLOWED_BY_POLICY",
  "DENIED_BY_POLICY",
  "DEFAULT_DENY",
  "INVALID_PERMISSION",
  "INVALID_SCOPE",
  "INVALID_POLICY",
  "MISSING_CONTEXT",
  "SCOPE_MISMATCH",
  "PERMISSION_MISMATCH",
  "CONDITION_NOT_MET",
  "UNSUPPORTED_CONDITION",
  "POLICY_DISABLED",
  "NO_MATCHING_POLICY",
  "CONFLICT_DENY_OVERRIDE",
  "INTERNAL_RESOLUTION_ERROR",
  "NOT_FOUND",
  "OUT_OF_SCOPE",
  "INSUFFICIENT_PERMISSION",
  "EXPLICIT_DENY",
  "SYSTEM_ERROR",
] as const;

export type DecisionReason = (typeof DECISION_REASONS)[number];

export type DecisionEvidenceValue = string | number | boolean | null;

interface DecisionResultDetails {
  readonly evidence?: Readonly<Record<string, DecisionEvidenceValue>>;
  readonly matchedPermission?: string;
  readonly matchedScope?: ResourceScope;
  readonly permission?: PermissionKey;
  readonly policyId?: string;
  readonly requestedPermission?: string;
  readonly requestedScope?: ResourceScope;
  readonly scope?: ResourceScope;
}

export type AllowDecisionReason = "PERMISSION_MATCH" | "ALLOWED_BY_POLICY";
export type DenyDecisionReason = Exclude<DecisionReason, AllowDecisionReason>;

export type DecisionResult =
  | Readonly<
      DecisionResultDetails & {
        readonly decision: "ALLOW";
        readonly reason: AllowDecisionReason;
      }
    >
  | Readonly<
      DecisionResultDetails & {
        readonly decision: "DENY";
        readonly reason: DenyDecisionReason;
      }
    >;
