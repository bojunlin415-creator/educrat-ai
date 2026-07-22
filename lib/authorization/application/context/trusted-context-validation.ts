import type {
  AuthorizationContextInput,
  AuthorizationIdentity,
  AuthorizationMembership,
  AuthorizationPersona,
  AuthorizationRole,
} from "@/lib/authorization/domain/context";
import { AUTHORIZATION_IDENTITY_TYPES } from "@/lib/authorization/domain/context";
import { isPermissionKey } from "@/lib/authorization/domain/permission";
import {
  isResourceScope,
  type ResourceScope,
} from "@/lib/authorization/domain/scope";
import type {
  MembershipAuthoritySnapshot,
  PermissionGrantAuthoritySnapshot,
  PersonaAuthoritySnapshot,
  RoleAuthoritySnapshot,
  ScopedAuthorizationRole,
} from "@/lib/authorization/interfaces/authorization-context-sources";
import { PERMISSION_AUTHORITY_TYPES } from "@/lib/authorization/interfaces/authorization-context-sources";
import { InvalidAuthorizationContextError } from "@/lib/authorization/application/errors/application-authorization-errors";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isActive(status: string): boolean {
  return status.toUpperCase() === "ACTIVE";
}

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function scopeKey(scope: ResourceScope): string {
  return [
    scope.type,
    scope.organizationId ?? "",
    scope.scopeId ?? "",
    scope.resourceId ?? "",
  ].join(":");
}

function assertIdentity(
  value: unknown,
): asserts value is AuthorizationIdentity {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    !(AUTHORIZATION_IDENTITY_TYPES as readonly unknown[]).includes(
      value.type,
    ) ||
    (value.personId !== undefined && !isNonEmptyString(value.personId))
  ) {
    throw new InvalidAuthorizationContextError();
  }
}

export function validateTrustedIdentity(value: unknown): AuthorizationIdentity {
  assertIdentity(value);
  return value;
}

function isMembership(value: unknown): value is AuthorizationMembership {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.organizationId) &&
    isNonEmptyString(value.status)
  );
}

function assertMembershipSnapshot(
  value: unknown,
  identity: AuthorizationIdentity,
): asserts value is MembershipAuthoritySnapshot {
  if (
    !isRecord(value) ||
    value.identityId !== identity.id ||
    !isNonEmptyString(value.activeOrganizationId) ||
    !Array.isArray(value.memberships) ||
    !value.memberships.every(isMembership) ||
    !hasUniqueValues(value.memberships.map((membership) => membership.id))
  ) {
    throw new InvalidAuthorizationContextError();
  }

  const activeMemberships = value.memberships.filter(
    (membership) =>
      membership.organizationId === value.activeOrganizationId &&
      isActive(membership.status),
  );
  if (activeMemberships.length !== 1) {
    throw new InvalidAuthorizationContextError();
  }
}

export function validateTrustedMembership(
  value: unknown,
  identity: AuthorizationIdentity,
): MembershipAuthoritySnapshot {
  assertMembershipSnapshot(value, identity);
  return value;
}

function isPersona(value: unknown): value is AuthorizationPersona {
  return (
    isRecord(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.organizationId) &&
    isNonEmptyString(value.status) &&
    isNonEmptyString(value.type)
  );
}

function assertPersonaSnapshot(
  value: unknown,
  identity: AuthorizationIdentity,
  activeOrganizationId: string,
): asserts value is PersonaAuthoritySnapshot {
  if (
    !isRecord(value) ||
    value.identityId !== identity.id ||
    value.activeOrganizationId !== activeOrganizationId ||
    !Array.isArray(value.personas) ||
    !value.personas.every(isPersona) ||
    !hasUniqueValues(value.personas.map((persona) => persona.id)) ||
    value.personas.some(
      (persona) => persona.organizationId !== activeOrganizationId,
    )
  ) {
    throw new InvalidAuthorizationContextError();
  }
}

function isScopedRole(value: unknown): value is ScopedAuthorizationRole {
  return (
    isRecord(value) &&
    isNonEmptyString(value.key) &&
    isNonEmptyString(value.organizationId) &&
    isNonEmptyString(value.status) &&
    isNonEmptyString(value.version) &&
    (value.assignmentId === undefined || isNonEmptyString(value.assignmentId))
  );
}

function roleIdentity(role: ScopedAuthorizationRole): string {
  return (
    role.assignmentId ?? `${role.organizationId}:${role.key}:${role.version}`
  );
}

function assertRoleSnapshot(
  value: unknown,
  identity: AuthorizationIdentity,
  activeOrganizationId: string,
): asserts value is RoleAuthoritySnapshot {
  if (
    !isRecord(value) ||
    value.identityId !== identity.id ||
    value.activeOrganizationId !== activeOrganizationId ||
    !Array.isArray(value.roles) ||
    !value.roles.every(isScopedRole) ||
    !hasUniqueValues(value.roles.map(roleIdentity)) ||
    value.roles.some((role) => role.organizationId !== activeOrganizationId)
  ) {
    throw new InvalidAuthorizationContextError();
  }
}

function assertPermissionGrantSnapshot(
  value: unknown,
  identity: AuthorizationIdentity,
  activeOrganizationId: string,
): asserts value is PermissionGrantAuthoritySnapshot {
  if (
    !isRecord(value) ||
    value.identityId !== identity.id ||
    value.activeOrganizationId !== activeOrganizationId ||
    !isRecord(value.authority) ||
    !isNonEmptyString(value.authority.id) ||
    value.authority.trusted !== true ||
    !isNonEmptyString(value.authority.version) ||
    !(PERMISSION_AUTHORITY_TYPES as readonly unknown[]).includes(
      value.authority.type,
    ) ||
    !Array.isArray(value.grants)
  ) {
    throw new InvalidAuthorizationContextError();
  }

  const grantKeys: string[] = [];
  const permissions = new Set<string>();
  const scopes = new Set<string>();
  for (const grant of value.grants) {
    if (
      !isRecord(grant) ||
      grant.organizationId !== activeOrganizationId ||
      !isPermissionKey(grant.permission) ||
      !isResourceScope(grant.scope) ||
      grant.scope.type === "PLATFORM" ||
      grant.scope.organizationId !== activeOrganizationId
    ) {
      throw new InvalidAuthorizationContextError();
    }
    const grantScopeKey = scopeKey(grant.scope);
    grantKeys.push(`${grant.permission}:${grantScopeKey}`);
    permissions.add(grant.permission);
    scopes.add(grantScopeKey);
  }
  if (!hasUniqueValues(grantKeys)) {
    throw new InvalidAuthorizationContextError();
  }

  const grantKeySet = new Set(grantKeys);
  for (const permission of permissions) {
    for (const scope of scopes) {
      if (!grantKeySet.has(`${permission}:${scope}`)) {
        throw new InvalidAuthorizationContextError();
      }
    }
  }
}

function copyRole(role: ScopedAuthorizationRole): AuthorizationRole {
  return Object.freeze({
    assignmentId: role.assignmentId,
    key: role.key,
    status: role.status,
    version: role.version,
  });
}

export function validateTrustedContextSources(
  input: Readonly<{
    identity: unknown;
    membership: unknown;
    permissionGrants: unknown;
    personas: unknown;
    roles: unknown;
  }>,
): AuthorizationContextInput {
  assertIdentity(input.identity);
  assertMembershipSnapshot(input.membership, input.identity);

  const activeOrganizationId = input.membership.activeOrganizationId;
  assertPersonaSnapshot(input.personas, input.identity, activeOrganizationId);
  assertRoleSnapshot(input.roles, input.identity, activeOrganizationId);
  assertPermissionGrantSnapshot(
    input.permissionGrants,
    input.identity,
    activeOrganizationId,
  );

  const activeMembership = input.membership.memberships.find(
    (membership) =>
      membership.organizationId === activeOrganizationId &&
      isActive(membership.status),
  );
  if (!activeMembership) throw new InvalidAuthorizationContextError();

  const permissions = Array.from(
    new Set(input.permissionGrants.grants.map((grant) => grant.permission)),
  );
  const scopes = Array.from(
    new Map(
      input.permissionGrants.grants.map((grant) => [
        scopeKey(grant.scope),
        grant.scope,
      ]),
    ).values(),
  );

  return Object.freeze({
    identity: input.identity,
    memberships: Object.freeze([activeMembership]),
    metadata: Object.freeze({
      source: "TRUSTED_AUTHORIZATION_CONTEXT_PROVIDER",
    }),
    permissions: Object.freeze(permissions),
    personas: Object.freeze(
      input.personas.personas.filter((persona) => isActive(persona.status)),
    ),
    roles: Object.freeze(
      input.roles.roles.filter((role) => isActive(role.status)).map(copyRole),
    ),
    scopes: Object.freeze(scopes),
  });
}
