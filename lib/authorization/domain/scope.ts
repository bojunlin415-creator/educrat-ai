import type { AuthorizationIdentifier } from "@/lib/authorization/shared/references";
import {
  isConditionAttributes,
  type ConditionAttributes,
} from "@/lib/authorization/domain/condition";

export const RESOURCE_SCOPE_TYPES = [
  "PLATFORM",
  "ORGANIZATION",
  "CAMPUS",
  "SCHOOL",
  "GRADE",
  "CLASS",
  "COURSE",
  "CURRICULUM",
  "CHAPTER",
  "LESSON",
  "WORKSHEET",
  "ASSESSMENT",
  "STUDENT",
  "GUARDIAN",
  "REPORT",
  "AUDIT",
  "NOTIFICATION",
] as const;

export type ResourceScopeType = (typeof RESOURCE_SCOPE_TYPES)[number];

export interface ResourceScope {
  readonly organizationId?: AuthorizationIdentifier;
  readonly resourceId?: AuthorizationIdentifier;
  readonly scopeId?: AuthorizationIdentifier;
  readonly type: ResourceScopeType;
}

export const RESOURCE_RELATIONSHIPS = [
  "NONE",
  "MEMBERSHIP",
  "PERSON",
  "PROFILE",
  "PERSONA",
  "OWN_RESOURCE",
  "MANAGED_RESOURCE",
] as const;

export type ResourceRelationship = (typeof RESOURCE_RELATIONSHIPS)[number];

export interface ResourceScopeExpression extends ResourceScope {
  readonly relationship?: ResourceRelationship;
}

export type ScopeLineage = Readonly<
  Partial<Record<ResourceScopeType, AuthorizationIdentifier>>
>;

export interface ScopeEvaluationAttributes {
  readonly actorProfileId?: AuthorizationIdentifier;
  readonly conditionAttributes?: ConditionAttributes;
  readonly lineage?: ScopeLineage;
  readonly managedByPersonIds?: readonly AuthorizationIdentifier[];
  readonly resourceMembershipId?: AuthorizationIdentifier;
  readonly resourceOwnerPersonId?: AuthorizationIdentifier;
  readonly resourcePersonId?: AuthorizationIdentifier;
  readonly resourcePersonaId?: AuthorizationIdentifier;
  readonly resourceProfileId?: AuthorizationIdentifier;
}

export interface ScopeEvaluationContext {
  readonly identity: Readonly<{
    readonly personId?: AuthorizationIdentifier;
  }>;
  readonly memberships: readonly Readonly<{
    readonly id: AuthorizationIdentifier;
    readonly organizationId: AuthorizationIdentifier;
    readonly status: string;
  }>[];
  readonly personas: readonly Readonly<{
    readonly id: AuthorizationIdentifier;
    readonly organizationId?: AuthorizationIdentifier;
    readonly status: string;
  }>[];
}

export const SCOPE_EVALUATION_REASONS = [
  "SCOPE_MATCH",
  "INVALID_SCOPE",
  "MISSING_SCOPE_CONTEXT",
  "ORGANIZATION_MISMATCH",
  "SCOPE_MISMATCH",
  "RELATIONSHIP_MISMATCH",
] as const;

export type ScopeEvaluationReason = (typeof SCOPE_EVALUATION_REASONS)[number];

export type ScopeEvaluationResult = Readonly<{
  matchedScope?: ResourceScope;
  matches: boolean;
  reason: ScopeEvaluationReason;
}>;

const SCOPED_CONTAINER_TYPES: readonly ResourceScopeType[] = [
  "CAMPUS",
  "SCHOOL",
  "GRADE",
  "CLASS",
  "COURSE",
];

const SCOPED_RESOURCE_TYPES: readonly ResourceScopeType[] = [
  "CURRICULUM",
  "CHAPTER",
  "LESSON",
  "WORKSHEET",
  "ASSESSMENT",
  "STUDENT",
  "GUARDIAN",
  "REPORT",
  "AUDIT",
  "NOTIFICATION",
];

function isNonEmptyIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isResourceScopeType(
  value: unknown,
): value is ResourceScopeType {
  return (
    typeof value === "string" &&
    (RESOURCE_SCOPE_TYPES as readonly string[]).includes(value)
  );
}

export function isResourceRelationship(
  value: unknown,
): value is ResourceRelationship {
  return (
    typeof value === "string" &&
    (RESOURCE_RELATIONSHIPS as readonly string[]).includes(value)
  );
}

export function isResourceScope(value: unknown): value is ResourceScope {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Readonly<Record<string, unknown>>;
  if (!isResourceScopeType(candidate.type)) return false;

  if (candidate.type === "PLATFORM") {
    return (
      candidate.organizationId === undefined &&
      candidate.resourceId === undefined &&
      candidate.scopeId === undefined
    );
  }

  if (!isNonEmptyIdentifier(candidate.organizationId)) return false;

  if (candidate.type === "ORGANIZATION") {
    return (
      candidate.resourceId === undefined &&
      (candidate.scopeId === undefined ||
        candidate.scopeId === candidate.organizationId)
    );
  }

  if (SCOPED_CONTAINER_TYPES.includes(candidate.type)) {
    return (
      isNonEmptyIdentifier(candidate.scopeId) &&
      candidate.resourceId === undefined
    );
  }

  if (SCOPED_RESOURCE_TYPES.includes(candidate.type)) {
    return (
      isNonEmptyIdentifier(candidate.resourceId) &&
      candidate.scopeId === undefined
    );
  }

  return false;
}

export function isResourceScopeExpression(
  value: unknown,
): value is ResourceScopeExpression {
  if (!isResourceScope(value)) return false;
  const relationship = (value as unknown as Readonly<Record<string, unknown>>)
    .relationship;
  return relationship === undefined || isResourceRelationship(relationship);
}

export function isScopeEvaluationAttributes(
  value: unknown,
): value is ScopeEvaluationAttributes {
  if (value === undefined) return true;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Readonly<Record<string, unknown>>;
  const identifierFields = [
    "actorProfileId",
    "resourceMembershipId",
    "resourceOwnerPersonId",
    "resourcePersonId",
    "resourcePersonaId",
    "resourceProfileId",
  ] as const;
  if (
    identifierFields.some(
      (field) =>
        candidate[field] !== undefined &&
        !isNonEmptyIdentifier(candidate[field]),
    )
  ) {
    return false;
  }
  if (
    candidate.managedByPersonIds !== undefined &&
    (!Array.isArray(candidate.managedByPersonIds) ||
      !candidate.managedByPersonIds.every(isNonEmptyIdentifier))
  ) {
    return false;
  }
  if (
    candidate.conditionAttributes !== undefined &&
    !isConditionAttributes(candidate.conditionAttributes)
  ) {
    return false;
  }
  if (candidate.lineage !== undefined) {
    if (
      typeof candidate.lineage !== "object" ||
      candidate.lineage === null ||
      Array.isArray(candidate.lineage)
    ) {
      return false;
    }
    for (const [type, identifier] of Object.entries(candidate.lineage)) {
      if (!isResourceScopeType(type) || !isNonEmptyIdentifier(identifier)) {
        return false;
      }
    }
  }
  return true;
}

function scopeIdentifier(scope: ResourceScope): string | undefined {
  if (scope.type === "ORGANIZATION") return scope.organizationId;
  return scope.scopeId ?? scope.resourceId;
}

function isActive(value: string): boolean {
  return value.toUpperCase() === "ACTIVE";
}

function matchesRelationship(
  relationship: ResourceRelationship,
  context: ScopeEvaluationContext,
  requestedScope: ResourceScope,
  attributes: ScopeEvaluationAttributes,
): boolean {
  if (relationship === "NONE") return true;

  const organizationId = requestedScope.organizationId;
  const personId = context.identity.personId;

  if (relationship === "MEMBERSHIP") {
    return context.memberships.some(
      (membership) =>
        membership.id === attributes.resourceMembershipId &&
        membership.organizationId === organizationId &&
        isActive(membership.status),
    );
  }
  if (relationship === "PERSON") {
    return personId !== undefined && personId === attributes.resourcePersonId;
  }
  if (relationship === "PROFILE") {
    return (
      attributes.actorProfileId !== undefined &&
      attributes.actorProfileId === attributes.resourceProfileId
    );
  }
  if (relationship === "PERSONA") {
    return context.personas.some(
      (persona) =>
        persona.id === attributes.resourcePersonaId &&
        persona.organizationId === organizationId &&
        isActive(persona.status),
    );
  }
  if (relationship === "OWN_RESOURCE") {
    return (
      personId !== undefined && personId === attributes.resourceOwnerPersonId
    );
  }
  if (relationship === "MANAGED_RESOURCE") {
    return (
      personId !== undefined &&
      attributes.managedByPersonIds?.includes(personId) === true
    );
  }

  return false;
}

function coversRequestedScope(
  grantedScope: ResourceScope,
  requestedScope: ResourceScope,
  attributes: ScopeEvaluationAttributes,
): boolean {
  if (grantedScope.type === "PLATFORM") {
    return requestedScope.type === "PLATFORM";
  }
  if (requestedScope.type === "PLATFORM") return false;
  if (grantedScope.organizationId !== requestedScope.organizationId) {
    return false;
  }
  if (grantedScope.type === "ORGANIZATION") return true;

  const grantedIdentifier = scopeIdentifier(grantedScope);
  if (grantedIdentifier === undefined) return false;

  if (grantedScope.type === requestedScope.type) {
    return grantedIdentifier === scopeIdentifier(requestedScope);
  }

  return attributes.lineage?.[grantedScope.type] === grantedIdentifier;
}

export function evaluateScopeCompatibility(input: {
  readonly attributes?: ScopeEvaluationAttributes;
  readonly context: ScopeEvaluationContext;
  readonly grantedScopes: readonly ResourceScope[];
  readonly policyScope?: ResourceScopeExpression;
  readonly requestedScope: unknown;
}): ScopeEvaluationResult {
  if (!isResourceScope(input.requestedScope)) {
    return { matches: false, reason: "INVALID_SCOPE" };
  }

  const requestedScope = input.requestedScope;
  const attributes = input.attributes ?? {};

  if (requestedScope.type !== "PLATFORM") {
    const hasActiveMembership = input.context.memberships.some(
      (membership) =>
        membership.organizationId === requestedScope.organizationId &&
        isActive(membership.status),
    );
    if (!hasActiveMembership) {
      return { matches: false, reason: "MISSING_SCOPE_CONTEXT" };
    }
  }

  if (
    input.policyScope !== undefined &&
    !isResourceScopeExpression(input.policyScope)
  ) {
    return { matches: false, reason: "INVALID_SCOPE" };
  }

  const policyScope = input.policyScope;
  if (
    policyScope?.organizationId !== undefined &&
    policyScope.organizationId !== requestedScope.organizationId
  ) {
    return { matches: false, reason: "ORGANIZATION_MISMATCH" };
  }

  const matchingGrant = input.grantedScopes.find((grantedScope) =>
    isResourceScope(grantedScope)
      ? coversRequestedScope(grantedScope, requestedScope, attributes)
      : false,
  );
  if (!matchingGrant) {
    return { matches: false, reason: "SCOPE_MISMATCH" };
  }

  if (
    policyScope !== undefined &&
    !coversRequestedScope(policyScope, requestedScope, attributes)
  ) {
    return { matches: false, reason: "SCOPE_MISMATCH" };
  }

  const relationship = policyScope?.relationship ?? "NONE";
  if (
    !matchesRelationship(
      relationship,
      input.context,
      requestedScope,
      attributes,
    )
  ) {
    return { matches: false, reason: "RELATIONSHIP_MISMATCH" };
  }

  return {
    matchedScope: matchingGrant,
    matches: true,
    reason: "SCOPE_MATCH",
  };
}
