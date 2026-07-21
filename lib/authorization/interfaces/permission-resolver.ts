import type { ScopeEvaluationAttributes } from "@/lib/authorization/domain/scope";
import type { DecisionResult } from "@/lib/authorization/domain/decision";
import type { AuthorizationResult } from "@/lib/authorization/domain/result";

export interface PermissionResolutionRequest {
  readonly context: unknown;
  readonly permission: unknown;
  readonly resourceAttributes?: ScopeEvaluationAttributes;
  readonly scope: unknown;
}

export interface PermissionResolver {
  resolve(
    request: PermissionResolutionRequest,
  ): Promise<AuthorizationResult<DecisionResult>>;
}
