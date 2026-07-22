import {
  authorize,
  authorizeApiRequest,
  authorizeServerAction,
  DefaultAuthorizationContextFactory,
  ForbiddenError,
  parsePermissionExpression,
  parsePermissionKey,
  type AuthorizationContextProvider,
  type AuthorizationDecisionEvaluator,
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

function contextInput() {
  return {
    identity: { id: "account-1", personId: "person-1", type: "ACCOUNT" },
    memberships: [{ id: "membership-1", organizationId, status: "ACTIVE" }],
    permissions: [permission],
    personas: [],
    roles: [],
    scopes: [organizationScope],
  };
}

function contextProvider(
  value: unknown = contextInput(),
): AuthorizationContextProvider {
  return { provide: vi.fn(async () => value) };
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

describe("AP-004C-A minimal authorization adapter", () => {
  it("delegates to the existing engine with a provider context", async () => {
    await expect(
      authorize(request(), { contextProvider: contextProvider() }),
    ).resolves.toMatchObject({ decision: "ALLOW" });
  });

  it("creates an immutable allowlisted context", async () => {
    const input = contextInput();
    const context = await new DefaultAuthorizationContextFactory().create(
      contextProvider(input),
    );
    input.memberships[0]!.organizationId = "changed";

    expect(context.memberships[0]?.organizationId).toBe(organizationId);
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.memberships[0])).toBe(true);
  });

  it("rejects malformed provider context", async () => {
    await expect(
      new DefaultAuthorizationContextFactory().create(contextProvider(null)),
    ).rejects.toMatchObject({ code: "INVALID_AUTHORIZATION_CONTEXT" });
  });

  it("maps allow and deny results for server and API helpers", async () => {
    await expect(
      authorizeServerAction(request(), { contextProvider: contextProvider() }),
    ).resolves.toMatchObject({ decision: "ALLOW" });

    const decision = Object.freeze({
      decision: "DENY",
      reason: "OUT_OF_SCOPE",
    } as const);
    const denied = await authorizeApiRequest(request(), {
      contextProvider: contextProvider(),
      evaluator: evaluator(decision),
    });
    expect(denied).toMatchObject({
      authorized: false,
      decision,
      error: { code: "FORBIDDEN", reason: "OUT_OF_SCOPE" },
    });
    expect(denied.authorized === false && denied.error).toBeInstanceOf(
      ForbiddenError,
    );
  });
});
