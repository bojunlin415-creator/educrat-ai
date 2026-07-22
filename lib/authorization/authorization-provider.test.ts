import {
  authorizationFailure,
  authorizationSuccess,
  AuthorizationError,
  DefaultAuthorizationProvider,
  parsePermissionKey,
  type AuthorizationContextInput,
  type AuthorizationContextProvider,
  type PermissionResolver,
  type PolicyResolver,
} from "@/lib/authorization";

describe("DefaultAuthorizationProvider", () => {
  it("delegates context creation without invoking either resolver", async () => {
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
    const input: AuthorizationContextInput = {
      identity: { id: "account-1", personId: "person-1", type: "ACCOUNT" },
      memberships: [
        {
          id: "membership-1",
          organizationId: "organization-1",
          status: "ACTIVE",
        },
      ],
      permissions: [permission],
      personas: [],
      roles: [],
      scopes: [
        {
          organizationId: "organization-1",
          scopeId: "organization-1",
          type: "ORGANIZATION",
        },
      ],
    };
    const contextProvider: AuthorizationContextProvider = {
      provide: vi.fn(async () => input),
    };

    const context = await provider.createContext(contextProvider);

    expect(context.memberships[0]?.organizationId).toBe("organization-1");
    expect(Object.isFrozen(context)).toBe(true);
    expect(permissionResolver.resolve).not.toHaveBeenCalled();
    expect(policyResolver.resolve).not.toHaveBeenCalled();
  });
});
