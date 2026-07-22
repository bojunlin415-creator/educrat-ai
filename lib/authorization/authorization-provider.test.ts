import {
  authorizationFailure,
  authorizationSuccess,
  AuthorizationError,
  DefaultAuthorizationContextProvider,
  DefaultAuthorizationProvider,
  parsePermissionKey,
  type AuthorizationContextProviderDependencies,
  type PermissionResolver,
  type PolicyResolver,
} from "@/lib/authorization";

function contextProviderDependencies(): AuthorizationContextProviderDependencies {
  const organizationId = "organization-1";
  const permission = parsePermissionKey("curriculum.read");
  const scope = {
    organizationId,
    scopeId: organizationId,
    type: "ORGANIZATION",
  } as const;
  return {
    identityProvider: {
      getIdentity: vi.fn(async () => ({
        id: "account-1",
        personId: "person-1",
        type: "ACCOUNT" as const,
      })),
    },
    membershipProvider: {
      getMemberships: vi.fn(async () => ({
        activeOrganizationId: organizationId,
        identityId: "account-1",
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
        identityId: "account-1",
      })),
    },
    personaProvider: {
      getPersonas: vi.fn(async () => ({
        activeOrganizationId: organizationId,
        identityId: "account-1",
        personas: [],
      })),
    },
    roleProvider: {
      getRoles: vi.fn(async () => ({
        activeOrganizationId: organizationId,
        identityId: "account-1",
        roles: [],
      })),
    },
  };
}

describe("DefaultAuthorizationProvider", () => {
  it("delegates trusted context creation without invoking either resolver", async () => {
    const permission = parsePermissionKey("curriculum.read");
    const permissionResolver: PermissionResolver = {
      resolve: vi.fn(async () =>
        authorizationSuccess({
          decision: "ALLOW",
          permission,
          reason: "PERMISSION_MATCH",
          requestedPermission: permission,
        } as const),
      ),
    };
    const policyResolver: PolicyResolver = {
      resolve: vi.fn(async () =>
        authorizationFailure(new AuthorizationError("SYSTEM_ERROR")),
      ),
    };
    const provider = new DefaultAuthorizationProvider({
      permissionResolver,
      policyResolver,
    });
    const contextProvider = new DefaultAuthorizationContextProvider(
      contextProviderDependencies(),
    );

    const context = await provider.createContext(contextProvider);

    expect(context.memberships[0]?.organizationId).toBe("organization-1");
    expect(context.permissions).toEqual([permission]);
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.identity)).toBe(true);
    expect(Object.isFrozen(context.memberships)).toBe(true);
    expect(Object.isFrozen(context.memberships[0])).toBe(true);
    expect(permissionResolver.resolve).not.toHaveBeenCalled();
    expect(policyResolver.resolve).not.toHaveBeenCalled();
    expect(provider.permissionResolver).toBe(permissionResolver);
    expect(provider.policyResolver).toBe(policyResolver);
  });
});
