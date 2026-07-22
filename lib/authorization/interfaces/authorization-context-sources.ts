import type {
  AuthorizationIdentity,
  AuthorizationMembership,
  AuthorizationPersona,
  AuthorizationRole,
} from "@/lib/authorization/domain/context";
import type { PermissionKey } from "@/lib/authorization/domain/permission";
import type { ResourceScope } from "@/lib/authorization/domain/scope";
import type { AuthorizationIdentifier } from "@/lib/authorization/shared/references";

export interface MembershipAuthoritySnapshot {
  readonly activeOrganizationId: AuthorizationIdentifier;
  readonly identityId: AuthorizationIdentifier;
  readonly memberships: readonly AuthorizationMembership[];
}

export interface PersonaAuthoritySnapshot {
  readonly activeOrganizationId: AuthorizationIdentifier;
  readonly identityId: AuthorizationIdentifier;
  readonly personas: readonly AuthorizationPersona[];
}

export interface ScopedAuthorizationRole extends AuthorizationRole {
  readonly organizationId: AuthorizationIdentifier;
}

export interface RoleAuthoritySnapshot {
  readonly activeOrganizationId: AuthorizationIdentifier;
  readonly identityId: AuthorizationIdentifier;
  readonly roles: readonly ScopedAuthorizationRole[];
}

export const PERMISSION_AUTHORITY_TYPES = [
  "ROLE_ASSIGNMENT",
  "PLATFORM_ROLE_ASSIGNMENT",
  "POLICY_CATALOG",
  "SERVICE_PRINCIPAL",
] as const;

export type PermissionAuthorityType =
  (typeof PERMISSION_AUTHORITY_TYPES)[number];

export interface TrustedPermissionAuthority {
  readonly id: AuthorizationIdentifier;
  readonly trusted: true;
  readonly type: PermissionAuthorityType;
  readonly version: string;
}

export interface PermissionGrant {
  readonly organizationId: AuthorizationIdentifier;
  readonly permission: PermissionKey;
  readonly scope: ResourceScope;
}

export interface PermissionGrantAuthoritySnapshot {
  readonly activeOrganizationId: AuthorizationIdentifier;
  readonly authority: TrustedPermissionAuthority;
  readonly grants: readonly PermissionGrant[];
  readonly identityId: AuthorizationIdentifier;
}

/** Trusted adapter port. A production implementation belongs to a later package. */
export interface IdentityProvider {
  getIdentity(): Promise<AuthorizationIdentity | null>;
}

/** Trusted adapter port. It must resolve membership from server-owned authority. */
export interface MembershipProvider {
  getMemberships(
    identity: AuthorizationIdentity,
  ): Promise<MembershipAuthoritySnapshot | null>;
}

/** Trusted adapter port. Persona data cannot be supplied by a product caller. */
export interface PersonaProvider {
  getPersonas(
    identity: AuthorizationIdentity,
    activeOrganizationId: AuthorizationIdentifier,
  ): Promise<PersonaAuthoritySnapshot>;
}

/** Trusted adapter port. Role assignments remain distinct from memberships. */
export interface RoleProvider {
  getRoles(
    identity: AuthorizationIdentity,
    activeOrganizationId: AuthorizationIdentifier,
  ): Promise<RoleAuthoritySnapshot>;
}

/** Trusted adapter port. Exact grants and their authority are resolved together. */
export interface PermissionGrantProvider {
  getPermissionGrants(
    identity: AuthorizationIdentity,
    activeOrganizationId: AuthorizationIdentifier,
  ): Promise<PermissionGrantAuthoritySnapshot>;
}
