import type { PermissionKey } from "@/lib/authorization/domain/permission";
import type { ResourceScope } from "@/lib/authorization/domain/scope";

export const AUTHORIZATION_DECISIONS = ["ALLOW", "DENY"] as const;

export type AuthorizationDecision = (typeof AUTHORIZATION_DECISIONS)[number];

export const DECISION_REASONS = [
  "PERMISSION_MATCH",
  "NOT_FOUND",
  "OUT_OF_SCOPE",
  "INSUFFICIENT_PERMISSION",
  "EXPLICIT_DENY",
  "SYSTEM_ERROR",
] as const;

export type DecisionReason = (typeof DECISION_REASONS)[number];

export type DecisionResult =
  | Readonly<{
      decision: "ALLOW";
      permission: PermissionKey;
      reason: "PERMISSION_MATCH";
      scope: ResourceScope;
    }>
  | Readonly<{
      decision: "DENY";
      permission: PermissionKey;
      reason: Exclude<DecisionReason, "PERMISSION_MATCH">;
      scope?: ResourceScope;
    }>;
