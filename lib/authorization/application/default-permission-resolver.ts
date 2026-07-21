import { isAuthorizationContext } from "@/lib/authorization/domain/context";
import type {
  DecisionResult,
  DenyDecisionReason,
} from "@/lib/authorization/domain/decision";
import { isPermissionKey } from "@/lib/authorization/domain/permission";
import { authorizationSuccess } from "@/lib/authorization/domain/result";
import {
  evaluateScopeCompatibility,
  isResourceScope,
  isScopeEvaluationAttributes,
} from "@/lib/authorization/domain/scope";
import type {
  PermissionResolutionRequest,
  PermissionResolver,
} from "@/lib/authorization/interfaces/permission-resolver";

function deny(
  reason: DenyDecisionReason,
  request: PermissionResolutionRequest,
): DecisionResult {
  return Object.freeze({
    decision: "DENY",
    reason,
    requestedPermission:
      typeof request.permission === "string" ? request.permission : undefined,
    requestedScope: isResourceScope(request.scope) ? request.scope : undefined,
  });
}

export class DefaultPermissionResolver implements PermissionResolver {
  async resolve(request: PermissionResolutionRequest) {
    if (!isAuthorizationContext(request.context)) {
      return authorizationSuccess(deny("MISSING_CONTEXT", request));
    }
    if (!isPermissionKey(request.permission)) {
      return authorizationSuccess(deny("INVALID_PERMISSION", request));
    }
    if (!isResourceScope(request.scope)) {
      return authorizationSuccess(deny("INVALID_SCOPE", request));
    }
    if (!isScopeEvaluationAttributes(request.resourceAttributes)) {
      return authorizationSuccess(deny("INVALID_SCOPE", request));
    }

    const permission = request.context.permissions.find(
      (candidate) => candidate === request.permission,
    );
    if (!permission) {
      return authorizationSuccess(deny("PERMISSION_MISMATCH", request));
    }

    const scopeResult = evaluateScopeCompatibility({
      attributes: request.resourceAttributes,
      context: request.context,
      grantedScopes: request.context.scopes,
      requestedScope: request.scope,
    });
    if (!scopeResult.matches) {
      const reason =
        scopeResult.reason === "INVALID_SCOPE"
          ? "INVALID_SCOPE"
          : scopeResult.reason === "MISSING_SCOPE_CONTEXT"
            ? "MISSING_CONTEXT"
            : "SCOPE_MISMATCH";
      return authorizationSuccess(deny(reason, request));
    }

    return authorizationSuccess(
      Object.freeze({
        decision: "ALLOW",
        matchedPermission: permission,
        matchedScope: scopeResult.matchedScope,
        permission,
        reason: "PERMISSION_MATCH",
        requestedPermission: permission,
        requestedScope: request.scope,
        scope: request.scope,
      }),
    );
  }
}
