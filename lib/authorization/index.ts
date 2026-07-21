export {
  AuthorizationEngine,
  createAuthorizationEngine,
  type AuthorizationEngineDependencies,
  type AuthorizationEvaluationRequest,
} from "@/lib/authorization/application/authorization-engine";
export { DefaultPermissionResolver } from "@/lib/authorization/application/default-permission-resolver";
export { DefaultPolicyResolver } from "@/lib/authorization/application/default-policy-resolver";
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
  isAuthorizationContext,
} from "@/lib/authorization/domain/context";
export {
  CONDITION_EVALUATION_STATUSES,
  evaluatePolicyCondition,
  validatePolicyCondition,
  type ConditionAttributes,
  type ConditionAttributeValue,
  type ConditionEvaluationResult,
  type ConditionEvaluationStatus,
  type ConditionPrimitive,
  type ConditionValidationStatus,
  isConditionAttributes,
  type PolicyCondition,
} from "@/lib/authorization/domain/condition";
export {
  AUTHORIZATION_DECISIONS,
  DECISION_REASONS,
  type AuthorizationDecision,
  type AllowDecisionReason,
  type DenyDecisionReason,
  type DecisionReason,
  type DecisionResult,
  type DecisionEvidenceValue,
} from "@/lib/authorization/domain/decision";
export {
  AUTHORIZATION_ERROR_CODES,
  AuthorizationError,
  type AuthorizationErrorCode,
} from "@/lib/authorization/domain/error";
export {
  isPermissionKey,
  isPermissionExpression,
  matchesPermissionExpression,
  parsePermissionKey,
  parsePermissionExpression,
  PERMISSION_KEY_PATTERN,
  RESOURCE_PERMISSION_WILDCARD_PATTERN,
  type PermissionExpression,
  type PermissionKey,
} from "@/lib/authorization/domain/permission";
export {
  authorizationFailure,
  authorizationSuccess,
  type AuthorizationResult,
} from "@/lib/authorization/domain/result";
export {
  comparePoliciesDeterministically,
  isAuthorizationPolicy,
  POLICY_EFFECTS,
  type AuthorizationPolicy,
  type PolicyEffect,
} from "@/lib/authorization/domain/policy";
export {
  evaluateScopeCompatibility,
  isResourceRelationship,
  isResourceScope,
  isResourceScopeExpression,
  isResourceScopeType,
  isScopeEvaluationAttributes,
  RESOURCE_RELATIONSHIPS,
  RESOURCE_SCOPE_TYPES,
  type ResourceScope,
  type ResourceRelationship,
  type ResourceScopeExpression,
  type ResourceScopeType,
  type ScopeEvaluationAttributes,
  type ScopeEvaluationContext,
  type ScopeEvaluationReason,
  type ScopeEvaluationResult,
  type ScopeLineage,
} from "@/lib/authorization/domain/scope";
export type {
  PermissionResolutionRequest,
  PermissionResolver,
} from "@/lib/authorization/interfaces/permission-resolver";
export type {
  PolicyResolutionRequest,
  PolicyResolver,
} from "@/lib/authorization/interfaces/policy-resolver";
export type {
  AuthorizationIdentifier,
  AuthorizationRequestMetadata,
} from "@/lib/authorization/shared/references";
