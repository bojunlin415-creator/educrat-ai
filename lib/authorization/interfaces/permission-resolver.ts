import type { PermissionResolutionContext } from "@/lib/authorization/domain/context";
import type { PermissionKey } from "@/lib/authorization/domain/permission";
import type { AuthorizationResult } from "@/lib/authorization/domain/result";

export interface PermissionResolver {
  resolve(
    context: PermissionResolutionContext,
  ): Promise<AuthorizationResult<readonly PermissionKey[]>>;
}
