import type { PermissionKey } from "@/lib/authorization/domain/permission";
import type { ResourceScope } from "@/lib/authorization/domain/scope";
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
