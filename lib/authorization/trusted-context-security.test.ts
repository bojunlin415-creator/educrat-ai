import {
  DefaultAuthorizationContextFactory,
  DefaultAuthorizationContextProvider,
  InvalidAuthorizationContextError,
  parsePermissionKey,
  UnauthenticatedError,
  type AuthorizationContextProviderDependencies,
  type AuthorizationIdentity,
  type MembershipAuthoritySnapshot,
  type PermissionGrantAuthoritySnapshot,
  type PermissionKey,
  type ResourceScope,
} from "@/lib/authorization";

const organizationId = "organization-1";
const identity: AuthorizationIdentity = Object.freeze({
  id: "account-1",
  personId: "person-1",
  type: "ACCOUNT",
});
const permission = parsePermissionKey("curriculum.read");
const scope: ResourceScope = Object.freeze({
  organizationId,
  scopeId: organizationId,
  type: "ORGANIZATION",
});

function dependencies(
  overrides: Partial<AuthorizationContextProviderDependencies> = {},
): AuthorizationContextProviderDependencies {
  return {
    identityProvider: { getIdentity: vi.fn(async () => identity) },
    membershipProvider: {
      getMemberships: vi.fn(async () => ({
        activeOrganizationId: organizationId,
        identityId: identity.id,
        memberships: [{ id: "membership-1", organizationId, status: "ACTIVE" }],
      })),
    },
    permissionGrantProvider: {
      getPermissionGrants: vi.fn(async () => ({
        activeOrganizationId: organizationId,
        authority: {
          id: "permission-authority-1",
          trusted: true as const,
          type: "ROLE_ASSIGNMENT" as const,
          version: "1",
        },
        grants: [{ organizationId, permission, scope }],
        identityId: identity.id,
      })),
    },
    personaProvider: {
      getPersonas: vi.fn(async () => ({
        activeOrganizationId: organizationId,
        identityId: identity.id,
        personas: [],
      })),
    },
    roleProvider: {
      getRoles: vi.fn(async () => ({
        activeOrganizationId: organizationId,
        identityId: identity.id,
        roles: [],
      })),
    },
    ...overrides,
  };
}

async function createContext(
  overrides: Partial<AuthorizationContextProviderDependencies>,
) {
  const provider = new DefaultAuthorizationContextProvider(
    dependencies(overrides),
  );
  return new DefaultAuthorizationContextFactory().create(provider);
}

describe("trusted authorization context fail-closed boundary", () => {
  it("rejects a forged identity", async () => {
    const forgedIdentity = {
      id: "forged-account",
      type: "PLATFORM_ADMIN",
    } as unknown as AuthorizationIdentity;
    await expect(
      createContext({
        identityProvider: {
          getIdentity: vi.fn(async () => forgedIdentity),
        },
      }),
    ).rejects.toBeInstanceOf(InvalidAuthorizationContextError);
  });

  it("rejects a forged membership identity", async () => {
    const forgedMembership: MembershipAuthoritySnapshot = {
      activeOrganizationId: organizationId,
      identityId: "another-account",
      memberships: [{ id: "membership-1", organizationId, status: "ACTIVE" }],
    };
    await expect(
      createContext({
        membershipProvider: {
          getMemberships: vi.fn(async () => forgedMembership),
        },
      }),
    ).rejects.toBeInstanceOf(InvalidAuthorizationContextError);
  });

  it("rejects a forged active organization", async () => {
    const forgedOrganization: MembershipAuthoritySnapshot = {
      activeOrganizationId: "organization-forged",
      identityId: identity.id,
      memberships: [{ id: "membership-1", organizationId, status: "ACTIVE" }],
    };
    await expect(
      createContext({
        membershipProvider: {
          getMemberships: vi.fn(async () => forgedOrganization),
        },
      }),
    ).rejects.toBeInstanceOf(InvalidAuthorizationContextError);
  });

  it("rejects a forged permission and untrusted permission authority", async () => {
    const forgedPermission = "curriculum.*" as PermissionKey;
    const untrusted = {
      activeOrganizationId: organizationId,
      authority: {
        id: "permission-authority-1",
        trusted: false,
        type: "ROLE_ASSIGNMENT",
        version: "1",
      },
      grants: [{ organizationId, permission: forgedPermission, scope }],
      identityId: identity.id,
    } as unknown as PermissionGrantAuthoritySnapshot;
    await expect(
      createContext({
        permissionGrantProvider: {
          getPermissionGrants: vi.fn(async () => untrusted),
        },
      }),
    ).rejects.toBeInstanceOf(InvalidAuthorizationContextError);
  });

  it("rejects a forged cross-organization scope", async () => {
    const forgedScope: ResourceScope = {
      organizationId: "organization-forged",
      scopeId: "organization-forged",
      type: "ORGANIZATION",
    };
    await expect(
      createContext({
        permissionGrantProvider: {
          getPermissionGrants: vi.fn(async () => ({
            activeOrganizationId: organizationId,
            authority: {
              id: "permission-authority-1",
              trusted: true as const,
              type: "ROLE_ASSIGNMENT" as const,
              version: "1",
            },
            grants: [{ organizationId, permission, scope: forgedScope }],
            identityId: identity.id,
          })),
        },
      }),
    ).rejects.toBeInstanceOf(InvalidAuthorizationContextError);
  });

  it("rejects a sparse permission-scope matrix that would widen grants", async () => {
    const lessonPermission = parsePermissionKey("lesson.read");
    const lessonScope: ResourceScope = {
      organizationId,
      resourceId: "lesson-1",
      type: "LESSON",
    };
    await expect(
      createContext({
        permissionGrantProvider: {
          getPermissionGrants: vi.fn(async () => ({
            activeOrganizationId: organizationId,
            authority: {
              id: "permission-authority-1",
              trusted: true as const,
              type: "ROLE_ASSIGNMENT" as const,
              version: "1",
            },
            grants: [
              { organizationId, permission, scope },
              {
                organizationId,
                permission: lessonPermission,
                scope: lessonScope,
              },
            ],
            identityId: identity.id,
          })),
        },
      }),
    ).rejects.toBeInstanceOf(InvalidAuthorizationContextError);
  });

  it("fails closed when identity is missing", async () => {
    await expect(
      createContext({
        identityProvider: { getIdentity: vi.fn(async () => null) },
      }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it("fails closed when membership is missing", async () => {
    await expect(
      createContext({
        membershipProvider: {
          getMemberships: vi.fn(async () => null),
        },
      }),
    ).rejects.toBeInstanceOf(InvalidAuthorizationContextError);
  });
});
