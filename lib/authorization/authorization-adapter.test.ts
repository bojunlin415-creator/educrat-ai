import {
  authorize,
  authorizeApiRequest,
  authorizeServerAction,
  DefaultAuthorizationContextFactory,
  DefaultAuthorizationContextProvider,
  ForbiddenError,
  InvalidAuthorizationContextError,
  parsePermissionExpression,
  parsePermissionKey,
  UnauthenticatedError,
  type AuthorizationContextProvider,
  type AuthorizationContextProviderDependencies,
  type AuthorizationDecisionEvaluator,
  type AuthorizationIdentity,
  type AuthorizationPolicy,
  type DecisionResult,
  type ResourceScope,
} from "@/lib/authorization";

const organizationId = "organization-1";
const permission = parsePermissionKey("curriculum.read");
const organizationScope: ResourceScope = Object.freeze({
  organizationId,
  scopeId: organizationId,
  type: "ORGANIZATION",
});
const curriculumScope: ResourceScope = Object.freeze({
  organizationId,
  resourceId: "curriculum-1",
  type: "CURRICULUM",
});
const allowPolicy: AuthorizationPolicy = Object.freeze({
  effect: "ALLOW",
  enabled: true,
  id: "allow-curriculum-read",
  permission: parsePermissionExpression("curriculum.read"),
  priority: 10,
  scope: organizationScope,
});

function trustedDependencies(
  overrides: Partial<AuthorizationContextProviderDependencies> = {},
): AuthorizationContextProviderDependencies {
  const identity: AuthorizationIdentity = Object.freeze({
    id: "account-1",
    personId: "person-1",
    type: "ACCOUNT",
  });
  return {
    identityProvider: {
      getIdentity: vi.fn(async () => identity),
    },
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
        grants: [{ organizationId, permission, scope: organizationScope }],
        identityId: identity.id,
      })),
    },
    personaProvider: {
      getPersonas: vi.fn(async () => ({
        activeOrganizationId: organizationId,
        identityId: identity.id,
        personas: [
          {
            id: "persona-1",
            organizationId,
            status: "ACTIVE",
            type: "TEACHER",
          },
        ],
      })),
    },
    roleProvider: {
      getRoles: vi.fn(async () => ({
        activeOrganizationId: organizationId,
        identityId: identity.id,
        roles: [
          {
            assignmentId: "assignment-1",
            key: "TEACHER",
            organizationId,
            status: "ACTIVE",
            version: "1",
          },
        ],
      })),
    },
    ...overrides,
  };
}

function contextProvider(
  overrides: Partial<AuthorizationContextProviderDependencies> = {},
): AuthorizationContextProvider {
  return new DefaultAuthorizationContextProvider(
    trustedDependencies(overrides),
  );
}

function request() {
  return {
    permission,
    policies: [allowPolicy],
    scope: curriculumScope,
  } as const;
}

function evaluator(decision: DecisionResult): AuthorizationDecisionEvaluator {
  return { evaluate: vi.fn(async () => decision) };
}

describe("AP-004C trusted authorization adapter", () => {
  it("uses trusted sources before invoking the existing authorization engine", async () => {
    await expect(
      authorize(request(), { contextProvider: contextProvider() }),
    ).resolves.toMatchObject({
      decision: "ALLOW",
      policyId: "allow-curriculum-read",
      reason: "ALLOWED_BY_POLICY",
    });
  });

  it("delegates exactly once with provider-issued context", async () => {
    const decision = Object.freeze({
      decision: "DENY",
      reason: "DEFAULT_DENY",
    } as const);
    const injected = evaluator(decision);

    await expect(
      authorize(request(), {
        contextProvider: contextProvider(),
        evaluator: injected,
      }),
    ).resolves.toBe(decision);
    expect(injected.evaluate).toHaveBeenCalledOnce();
    expect(injected.evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          identity: expect.objectContaining({ id: "account-1" }),
          permissions: [permission],
        }),
        ...request(),
      }),
    );
  });

  it("builds an immutable allowlisted context from trusted authorities", async () => {
    const membership = {
      id: "membership-1",
      organizationId,
      status: "ACTIVE",
    };
    const provider = contextProvider({
      membershipProvider: {
        getMemberships: vi.fn(async (identity) => ({
          activeOrganizationId: organizationId,
          identityId: identity.id,
          memberships: [membership],
        })),
      },
    });
    const result = await new DefaultAuthorizationContextFactory().create(
      provider,
    );
    membership.organizationId = "organization-changed";

    expect(result.memberships[0]?.organizationId).toBe(organizationId);
    expect(result.metadata).toEqual({
      source: "TRUSTED_AUTHORIZATION_CONTEXT_PROVIDER",
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.identity)).toBe(true);
    expect(Object.isFrozen(result.memberships)).toBe(true);
    expect(Object.isFrozen(result.memberships[0])).toBe(true);
    expect(Object.isFrozen(result.metadata)).toBe(true);
  });

  it("rejects a structurally valid context that was not issued by the trusted provider", async () => {
    const forgedProvider: AuthorizationContextProvider = {
      provide: vi.fn(async () => ({
        context: {
          identity: { id: "forged-account", type: "ACCOUNT" as const },
          memberships: [
            { id: "forged-membership", organizationId, status: "ACTIVE" },
          ],
          permissions: [permission],
          personas: [],
          roles: [],
          scopes: [organizationScope],
        },
      })),
    };

    await expect(
      new DefaultAuthorizationContextFactory().create(forgedProvider),
    ).rejects.toBeInstanceOf(InvalidAuthorizationContextError);
  });

  it("returns an allow decision for a server action", async () => {
    await expect(
      authorizeServerAction(request(), { contextProvider: contextProvider() }),
    ).resolves.toMatchObject({
      decision: "ALLOW",
      reason: "ALLOWED_BY_POLICY",
    });
  });

  it("throws typed server action errors before evaluation when identity or membership is missing", async () => {
    const injected = evaluator(
      Object.freeze({ decision: "ALLOW", reason: "PERMISSION_MATCH" }),
    );
    await expect(
      authorizeServerAction(request(), {
        contextProvider: contextProvider({
          identityProvider: { getIdentity: vi.fn(async () => null) },
        }),
        evaluator: injected,
      }),
    ).rejects.toBeInstanceOf(UnauthenticatedError);
    await expect(
      authorizeServerAction(request(), {
        contextProvider: contextProvider({
          membershipProvider: {
            getMemberships: vi.fn(async () => null),
          },
        }),
        evaluator: injected,
      }),
    ).rejects.toBeInstanceOf(InvalidAuthorizationContextError);
    expect(injected.evaluate).not.toHaveBeenCalled();
  });

  it("throws a typed forbidden server action error for a denied decision", async () => {
    const denied = evaluator(
      Object.freeze({ decision: "DENY", reason: "EXPLICIT_DENY" }),
    );
    await expect(
      authorizeServerAction(request(), {
        contextProvider: contextProvider(),
        evaluator: denied,
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      reason: "EXPLICIT_DENY",
    });
  });

  it("returns framework-neutral API results without translating to HTTP", async () => {
    const allowed = await authorizeApiRequest(request(), {
      contextProvider: contextProvider(),
    });
    expect(allowed).toMatchObject({
      authorized: true,
      decision: { decision: "ALLOW" },
    });

    const deniedDecision = Object.freeze({
      decision: "DENY",
      reason: "OUT_OF_SCOPE",
    } as const);
    const deniedEvaluator = evaluator(deniedDecision);
    const denied = await authorizeApiRequest(request(), {
      contextProvider: contextProvider(),
      evaluator: deniedEvaluator,
    });
    expect(denied).toMatchObject({
      authorized: false,
      decision: deniedDecision,
      error: { code: "FORBIDDEN", reason: "OUT_OF_SCOPE" },
    });
    expect(deniedEvaluator.evaluate).toHaveBeenCalledOnce();
    expect(denied.authorized === false && denied.error).toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("maps missing and invalid trusted sources for API callers", async () => {
    const injected = evaluator(
      Object.freeze({ decision: "ALLOW", reason: "PERMISSION_MATCH" }),
    );
    const missing = await authorizeApiRequest(request(), {
      contextProvider: contextProvider({
        identityProvider: { getIdentity: vi.fn(async () => null) },
      }),
      evaluator: injected,
    });
    const invalid = await authorizeApiRequest(request(), {
      contextProvider: contextProvider({
        membershipProvider: {
          getMemberships: vi.fn(async (identity) => ({
            activeOrganizationId: "organization-forged",
            identityId: identity.id,
            memberships: [
              { id: "membership-1", organizationId, status: "ACTIVE" },
            ],
          })),
        },
      }),
      evaluator: injected,
    });

    expect(missing).toMatchObject({
      authorized: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(invalid).toMatchObject({
      authorized: false,
      error: { code: "INVALID_AUTHORIZATION_CONTEXT" },
    });
    expect(injected.evaluate).not.toHaveBeenCalled();
  });
});
