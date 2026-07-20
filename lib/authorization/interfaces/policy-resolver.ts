import type { AuthorizationContext } from "@/lib/authorization/domain/context";
import type { DecisionResult } from "@/lib/authorization/domain/decision";
import type { PermissionKey } from "@/lib/authorization/domain/permission";
import type { AuthorizationResult } from "@/lib/authorization/domain/result";
import type { ResourceScope } from "@/lib/authorization/domain/scope";

export interface PolicyResolutionRequest {
  readonly context: AuthorizationContext;
  readonly permission: PermissionKey;
  readonly scope: ResourceScope;
}

export interface PolicyResolver {
  resolve(
    request: PolicyResolutionRequest,
  ): Promise<AuthorizationResult<DecisionResult>>;
}
