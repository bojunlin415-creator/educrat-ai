export {
  DefaultAuthorizationProvider,
  type AuthorizationProvider,
  type AuthorizationProviderDependencies,
} from "@/lib/authorization/application/authorization-provider";
export {
  AUTHORIZATION_IDENTITY_TYPES,
  type AuthorizationContext,
  type AuthorizationContextInput,
  type AuthorizationIdentity,
  type AuthorizationIdentityType,
  type AuthorizationMembership,
  type AuthorizationPersona,
  type AuthorizationRole,
  type PermissionResolutionContext,
} from "@/lib/authorization/domain/context";
export {
  AUTHORIZATION_DECISIONS,
  DECISION_REASONS,
  type AuthorizationDecision,
  type DecisionReason,
  type DecisionResult,
} from "@/lib/authorization/domain/decision";
export {
  AUTHORIZATION_ERROR_CODES,
  AuthorizationError,
  type AuthorizationErrorCode,
} from "@/lib/authorization/domain/error";
export {
  isPermissionKey,
  parsePermissionKey,
  PERMISSION_KEY_PATTERN,
  type PermissionKey,
} from "@/lib/authorization/domain/permission";
export {
  authorizationFailure,
  authorizationSuccess,
  type AuthorizationResult,
} from "@/lib/authorization/domain/result";
export {
  RESOURCE_SCOPE_TYPES,
  type ResourceScope,
  type ResourceScopeType,
} from "@/lib/authorization/domain/scope";
export type { PermissionResolver } from "@/lib/authorization/interfaces/permission-resolver";
export type {
  PolicyResolutionRequest,
  PolicyResolver,
} from "@/lib/authorization/interfaces/policy-resolver";
export type {
  AuthorizationIdentifier,
  AuthorizationRequestMetadata,
} from "@/lib/authorization/shared/references";
