import {
  authorizationFailure,
  authorizationSuccess,
  AuthorizationError,
  DefaultAuthorizationProvider,
  parsePermissionKey,
  type AuthorizationContextInput,
  type PermissionResolver,
  type PolicyResolver,
} from "@/lib/authorization";

describe("DefaultAuthorizationProvider", () => {
  it("assembles an immutable context without invoking either resolver", () => {
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
    const membership = {
      id: "membership-1",
      organizationId: "organization-1",
      status: "ACTIVE",
    };
    const input: AuthorizationContextInput = {
      identity: {
        id: "account-1",
        personId: "person-1",
        type: "ACCOUNT",
      },
      memberships: [membership],
      metadata: { correlationId: "correlation-1" },
      permissions: [permission],
      personas: [
        {
          id: "persona-1",
          organizationId: "organization-1",
          status: "ACTIVE",
          type: "TEACHER",
        },
      ],
      roles: [
        {
          assignmentId: "assignment-1",
          key: "TEACHER",
          status: "ACTIVE",
          version: "1",
        },
      ],
      scopes: [
        {
          organizationId: "organization-1",
          scopeId: "organization-1",
          type: "ORGANIZATION",
        },
      ],
    };

    const context = provider.createContext(input);
    membership.organizationId = "changed-after-context-creation";

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
