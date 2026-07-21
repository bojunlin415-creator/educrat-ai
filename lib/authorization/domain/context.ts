import {
  isPermissionKey,
  type PermissionKey,
} from "@/lib/authorization/domain/permission";
import {
  isResourceScope,
  type ResourceScope,
} from "@/lib/authorization/domain/scope";
import type {
  AuthorizationIdentifier,
  AuthorizationRequestMetadata,
} from "@/lib/authorization/shared/references";

export const AUTHORIZATION_IDENTITY_TYPES = [
  "ACCOUNT",
  "SERVICE_PRINCIPAL",
] as const;

export type AuthorizationIdentityType =
  (typeof AUTHORIZATION_IDENTITY_TYPES)[number];

export interface AuthorizationIdentity {
  readonly id: AuthorizationIdentifier;
  readonly personId?: AuthorizationIdentifier;
  readonly type: AuthorizationIdentityType;
}

export interface AuthorizationMembership {
  readonly id: AuthorizationIdentifier;
  readonly organizationId: AuthorizationIdentifier;
  readonly status: string;
}

export interface AuthorizationPersona {
  readonly id: AuthorizationIdentifier;
  readonly organizationId?: AuthorizationIdentifier;
  readonly status: string;
  readonly type: string;
}

export interface AuthorizationRole {
  readonly assignmentId?: AuthorizationIdentifier;
  readonly key: string;
  readonly status: string;
  readonly version: string;
}

export interface AuthorizationContextInput {
  readonly identity: AuthorizationIdentity;
  readonly memberships: readonly AuthorizationMembership[];
  readonly metadata?: AuthorizationRequestMetadata;
  readonly permissions: readonly PermissionKey[];
  readonly personas: readonly AuthorizationPersona[];
  readonly roles: readonly AuthorizationRole[];
  readonly scopes: readonly ResourceScope[];
}

export type AuthorizationContext = AuthorizationContextInput;

export type PermissionResolutionContext = Omit<
  AuthorizationContext,
  "permissions"
>;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isAuthorizationContext(
  value: unknown,
): value is AuthorizationContext {
  if (!isRecord(value) || !isRecord(value.identity)) return false;
  if (
    !isNonEmptyString(value.identity.id) ||
    !(AUTHORIZATION_IDENTITY_TYPES as readonly unknown[]).includes(
      value.identity.type,
    )
  ) {
    return false;
  }
  if (
    value.identity.personId !== undefined &&
    !isNonEmptyString(value.identity.personId)
  ) {
    return false;
  }
  if (
    !Array.isArray(value.memberships) ||
    !Array.isArray(value.permissions) ||
    !Array.isArray(value.personas) ||
    !Array.isArray(value.roles) ||
    !Array.isArray(value.scopes)
  ) {
    return false;
  }

  const membershipsAreValid = value.memberships.every(
    (membership) =>
      isRecord(membership) &&
      isNonEmptyString(membership.id) &&
      isNonEmptyString(membership.organizationId) &&
      isNonEmptyString(membership.status),
  );
  const personasAreValid = value.personas.every(
    (persona) =>
      isRecord(persona) &&
      isNonEmptyString(persona.id) &&
      isNonEmptyString(persona.status) &&
      isNonEmptyString(persona.type) &&
      (persona.organizationId === undefined ||
        isNonEmptyString(persona.organizationId)),
  );
  const rolesAreValid = value.roles.every(
    (role) =>
      isRecord(role) &&
      isNonEmptyString(role.key) &&
      isNonEmptyString(role.status) &&
      isNonEmptyString(role.version) &&
      (role.assignmentId === undefined || isNonEmptyString(role.assignmentId)),
  );

  return (
    membershipsAreValid &&
    personasAreValid &&
    rolesAreValid &&
    value.permissions.every(isPermissionKey) &&
    value.scopes.every(isResourceScope)
  );
}
