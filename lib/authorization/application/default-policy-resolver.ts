import {
  evaluatePolicyCondition,
  type ConditionAttributes,
  validatePolicyCondition,
} from "@/lib/authorization/domain/condition";
import type { DecisionResult } from "@/lib/authorization/domain/decision";
import { matchesPermissionExpression } from "@/lib/authorization/domain/permission";
import {
  comparePoliciesDeterministically,
  isAuthorizationPolicy,
  type AuthorizationPolicy,
} from "@/lib/authorization/domain/policy";
import { authorizationSuccess } from "@/lib/authorization/domain/result";
import { evaluateScopeCompatibility } from "@/lib/authorization/domain/scope";
import type {
  PolicyResolutionRequest,
  PolicyResolver,
} from "@/lib/authorization/interfaces/policy-resolver";

function result(
  request: PolicyResolutionRequest,
  reason: DecisionResult["reason"],
  policy?: AuthorizationPolicy,
  matchedScope = request.scope,
): DecisionResult {
  const details = {
    evidence: policy
      ? Object.freeze({
          effect: policy.effect,
          priority: policy.priority,
        })
      : undefined,
    matchedPermission: policy?.permission,
    matchedScope: policy ? matchedScope : undefined,
    permission: request.permission,
    policyId: policy?.id,
    reason,
    requestedPermission: request.permission,
    requestedScope: request.scope,
    scope: request.scope,
  } as const;
  if (reason === "ALLOWED_BY_POLICY" || reason === "PERMISSION_MATCH") {
    return Object.freeze({ ...details, decision: "ALLOW", reason });
  }
  return Object.freeze({ ...details, decision: "DENY", reason });
}

function conditionAttributes(
  request: PolicyResolutionRequest,
): ConditionAttributes {
  return request.resourceAttributes?.conditionAttributes ?? {};
}

export class DefaultPolicyResolver implements PolicyResolver {
  async resolve(request: PolicyResolutionRequest) {
    if (request.policies.length === 0) {
      return authorizationSuccess(result(request, "DEFAULT_DENY"));
    }
    if (!request.policies.every(isAuthorizationPolicy)) {
      return authorizationSuccess(result(request, "INVALID_POLICY"));
    }
    if (
      new Set(request.policies.map((policy) => policy.id)).size !==
      request.policies.length
    ) {
      return authorizationSuccess(result(request, "INVALID_POLICY"));
    }

    for (const policy of request.policies) {
      if (policy.conditions === undefined) continue;
      const conditionStatus = validatePolicyCondition(policy.conditions);
      if (conditionStatus !== "VALID") {
        return authorizationSuccess(
          result(
            request,
            conditionStatus === "UNSUPPORTED_OPERATOR"
              ? "UNSUPPORTED_CONDITION"
              : "INVALID_POLICY",
            policy,
          ),
        );
      }
    }

    const enabledPolicies = [...request.policies]
      .filter((policy) => policy.enabled)
      .sort(comparePoliciesDeterministically);
    if (enabledPolicies.length === 0) {
      return authorizationSuccess(result(request, "POLICY_DISABLED"));
    }

    const permissionMatches = enabledPolicies.filter((policy) =>
      matchesPermissionExpression(policy.permission, request.permission),
    );
    if (permissionMatches.length === 0) {
      return authorizationSuccess(result(request, "NO_MATCHING_POLICY"));
    }

    const scopeMatches = permissionMatches.filter(
      (policy) =>
        evaluateScopeCompatibility({
          attributes: request.resourceAttributes,
          context: request.context,
          grantedScopes: request.context.scopes,
          policyScope: policy.scope,
          requestedScope: request.scope,
        }).matches,
    );
    if (scopeMatches.length === 0) {
      return authorizationSuccess(result(request, "SCOPE_MISMATCH"));
    }

    const matchedPolicies: AuthorizationPolicy[] = [];
    let sawConditionMismatch = false;
    for (const policy of scopeMatches) {
      if (policy.conditions === undefined) {
        matchedPolicies.push(policy);
        continue;
      }
      const condition = evaluatePolicyCondition(
        policy.conditions,
        conditionAttributes(request),
      );
      if (
        condition.status === "UNSUPPORTED_OPERATOR" ||
        condition.status === "INVALID_CONDITION" ||
        condition.status === "MISSING_ATTRIBUTE"
      ) {
        return authorizationSuccess(
          result(
            request,
            condition.status === "UNSUPPORTED_OPERATOR"
              ? "UNSUPPORTED_CONDITION"
              : condition.status === "MISSING_ATTRIBUTE"
                ? "MISSING_CONTEXT"
                : "INVALID_POLICY",
            policy,
          ),
        );
      }
      if (condition.matches) matchedPolicies.push(policy);
      else sawConditionMismatch = true;
    }

    const denyPolicy = matchedPolicies.find(
      (policy) => policy.effect === "DENY",
    );
    const allowPolicy = matchedPolicies.find(
      (policy) => policy.effect === "ALLOW",
    );
    if (denyPolicy) {
      return authorizationSuccess(
        result(
          request,
          allowPolicy ? "CONFLICT_DENY_OVERRIDE" : "DENIED_BY_POLICY",
          denyPolicy,
        ),
      );
    }
    if (allowPolicy) {
      return authorizationSuccess(
        result(request, "ALLOWED_BY_POLICY", allowPolicy),
      );
    }

    return authorizationSuccess(
      result(
        request,
        sawConditionMismatch ? "CONDITION_NOT_MET" : "DEFAULT_DENY",
      ),
    );
  }
}
