import { isAuthorizationContext } from "@/lib/authorization/domain/context";
import type { DecisionResult } from "@/lib/authorization/domain/decision";
import { AuthorizationError } from "@/lib/authorization/domain/error";
import { isPermissionKey } from "@/lib/authorization/domain/permission";
import type { AuthorizationPolicy } from "@/lib/authorization/domain/policy";
import {
  isResourceScope,
  type ScopeEvaluationAttributes,
} from "@/lib/authorization/domain/scope";
import type { PermissionResolver } from "@/lib/authorization/interfaces/permission-resolver";
import type { PolicyResolver } from "@/lib/authorization/interfaces/policy-resolver";
import { DefaultPermissionResolver } from "@/lib/authorization/application/default-permission-resolver";
import { DefaultPolicyResolver } from "@/lib/authorization/application/default-policy-resolver";

export interface AuthorizationEvaluationRequest {
  readonly context: unknown;
  readonly permission: unknown;
  readonly policies: readonly (AuthorizationPolicy | unknown)[];
  readonly resourceAttributes?: ScopeEvaluationAttributes;
  readonly scope: unknown;
}

export interface AuthorizationEngineDependencies {
  readonly permissionResolver: PermissionResolver;
  readonly policyResolver: PolicyResolver;
}

function internalFailure(
  request: AuthorizationEvaluationRequest,
): DecisionResult {
  return Object.freeze({
    decision: "DENY",
    reason: "INTERNAL_RESOLUTION_ERROR",
    requestedPermission:
      typeof request.permission === "string" ? request.permission : undefined,
    requestedScope: isResourceScope(request.scope) ? request.scope : undefined,
  });
}

export class AuthorizationEngine {
  readonly permissionResolver: PermissionResolver;
  readonly policyResolver: PolicyResolver;

  constructor(dependencies: AuthorizationEngineDependencies) {
    this.permissionResolver = dependencies.permissionResolver;
    this.policyResolver = dependencies.policyResolver;
  }

  async evaluate(
    request: AuthorizationEvaluationRequest,
  ): Promise<DecisionResult> {
    try {
      const permissionResolution = await this.permissionResolver.resolve({
        context: request.context,
        permission: request.permission,
        resourceAttributes: request.resourceAttributes,
        scope: request.scope,
      });
      if (!permissionResolution.ok) return internalFailure(request);
      if (permissionResolution.value.decision === "DENY") {
        return permissionResolution.value;
      }
      if (
        !isAuthorizationContext(request.context) ||
        !isPermissionKey(request.permission) ||
        !isResourceScope(request.scope)
      ) {
        return internalFailure(request);
      }

      const policyResolution = await this.policyResolver.resolve({
        context: request.context,
        permission: request.permission,
        policies: request.policies,
        resourceAttributes: request.resourceAttributes,
        scope: request.scope,
      });
      return policyResolution.ok
        ? policyResolution.value
        : internalFailure(request);
    } catch (error) {
      if (error instanceof AuthorizationError) return internalFailure(request);
      throw error;
    }
  }
}

export function createAuthorizationEngine(): AuthorizationEngine {
  return new AuthorizationEngine({
    permissionResolver: new DefaultPermissionResolver(),
    policyResolver: new DefaultPolicyResolver(),
  });
}
