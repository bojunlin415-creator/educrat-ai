import type { PolicyCondition } from "@/lib/authorization/domain/condition";
import {
  isPermissionExpression,
  type PermissionExpression,
} from "@/lib/authorization/domain/permission";
import {
  isResourceScopeExpression,
  type ResourceScopeExpression,
} from "@/lib/authorization/domain/scope";

export const POLICY_EFFECTS = ["ALLOW", "DENY"] as const;
export type PolicyEffect = (typeof POLICY_EFFECTS)[number];

export interface AuthorizationPolicy {
  readonly conditions?: PolicyCondition;
  readonly description?: string;
  readonly effect: PolicyEffect;
  readonly enabled: boolean;
  readonly id: string;
  readonly permission: PermissionExpression;
  readonly priority: number;
  readonly scope: ResourceScopeExpression;
}

export function isAuthorizationPolicy(
  value: unknown,
): value is AuthorizationPolicy {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Readonly<Record<string, unknown>>;
  return (
    typeof candidate.id === "string" &&
    /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(candidate.id) &&
    (candidate.effect === "ALLOW" || candidate.effect === "DENY") &&
    typeof candidate.enabled === "boolean" &&
    typeof candidate.priority === "number" &&
    Number.isSafeInteger(candidate.priority) &&
    isPermissionExpression(candidate.permission) &&
    isResourceScopeExpression(candidate.scope) &&
    (candidate.description === undefined ||
      typeof candidate.description === "string")
  );
}

export function comparePoliciesDeterministically(
  left: AuthorizationPolicy,
  right: AuthorizationPolicy,
): number {
  if (left.effect !== right.effect) return left.effect === "DENY" ? -1 : 1;
  if (left.priority !== right.priority) return right.priority - left.priority;
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}
