import {
  authorizationFailure,
  authorizationSuccess,
  AuthorizationEngine,
  AuthorizationError,
  createAuthorizationEngine,
  parsePermissionExpression,
  parsePermissionKey,
  type AuthorizationContext,
  type AuthorizationPolicy,
  type PermissionResolver,
  type PolicyResolver,
  type ResourceScope,
  type ScopeEvaluationAttributes,
} from "@/lib/authorization";

const organizationId = "organization-1";
const requestedPermission = parsePermissionKey("curriculum.read");
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

function context(
  overrides: Partial<AuthorizationContext> = {},
): AuthorizationContext {
  return {
    identity: { id: "account-1", personId: "person-1", type: "ACCOUNT" },
    memberships: [{ id: "membership-1", organizationId, status: "ACTIVE" }],
    permissions: [requestedPermission],
    personas: [],
    roles: [],
    scopes: [organizationScope],
    ...overrides,
  };
}

function policy(
  overrides: Partial<AuthorizationPolicy> = {},
): AuthorizationPolicy {
  return Object.freeze({
    effect: "ALLOW",
    enabled: true,
    id: "policy-allow",
    permission: parsePermissionExpression("curriculum.read"),
    priority: 10,
    scope: organizationScope,
    ...overrides,
  });
}

function request(policies: readonly unknown[]) {
  return {
    context: context(),
    permission: requestedPermission,
    policies,
    scope: curriculumScope,
  } as const;
}

describe("authorization decision engine", () => {
  it("allows an exact explicit grant with an enabled allow policy", async () => {
    const decision = await createAuthorizationEngine().evaluate(
      request([policy()]),
    );
    expect(decision).toMatchObject({
      decision: "ALLOW",
      matchedPermission: "curriculum.read",
      policyId: "policy-allow",
      reason: "ALLOWED_BY_POLICY",
    });
  });

  it.each(["curriculum.*", "*"])(
    "allows a matching runtime policy expression %s only after exact context grant",
    async (expression) => {
      const decision = await createAuthorizationEngine().evaluate(
        request([
          policy({ permission: parsePermissionExpression(expression) }),
        ]),
      );
      expect(decision.decision).toBe("ALLOW");
      expect(decision.matchedPermission).toBe(expression);
    },
  );

  it("does not let a wildcard policy manufacture a missing catalog grant", async () => {
    const evaluation = request([
      policy({ permission: parsePermissionExpression("*") }),
    ]);
    const decision = await createAuthorizationEngine().evaluate({
      ...evaluation,
      context: context({
        permissions: [],
        roles: [{ key: "OWNER", status: "ACTIVE", version: "1" }],
      }),
    });
    expect(decision).toMatchObject({
      decision: "DENY",
      reason: "PERMISSION_MISMATCH",
    });
  });

  it("denies by default when policy collection is empty", async () => {
    await expect(
      createAuthorizationEngine().evaluate(request([])),
    ).resolves.toMatchObject({
      decision: "DENY",
      reason: "DEFAULT_DENY",
    });
  });

  it("uses explicit deny over allow regardless of priority", async () => {
    const decision = await createAuthorizationEngine().evaluate(
      request([
        policy({ id: "high-allow", priority: 1_000 }),
        policy({ effect: "DENY", id: "low-deny", priority: -1_000 }),
      ]),
    );
    expect(decision).toMatchObject({
      decision: "DENY",
      policyId: "low-deny",
      reason: "CONFLICT_DENY_OVERRIDE",
    });
  });

  it("returns the matching explicit deny when no allow policy exists", async () => {
    await expect(
      createAuthorizationEngine().evaluate(
        request([policy({ effect: "DENY", id: "deny-only" })]),
      ),
    ).resolves.toMatchObject({
      decision: "DENY",
      policyId: "deny-only",
      reason: "DENIED_BY_POLICY",
    });
  });

  it("denies disabled and non-matching policies", async () => {
    await expect(
      createAuthorizationEngine().evaluate(
        request([policy({ enabled: false })]),
      ),
    ).resolves.toMatchObject({
      decision: "DENY",
      reason: "POLICY_DISABLED",
    });
    await expect(
      createAuthorizationEngine().evaluate(
        request([
          policy({
            permission: parsePermissionExpression("lesson.read"),
          }),
        ]),
      ),
    ).resolves.toMatchObject({
      decision: "DENY",
      reason: "NO_MATCHING_POLICY",
    });
  });

  it("uses deterministic priority then policy id ordering within one effect", async () => {
    const policies = [
      policy({ id: "z-policy", priority: 20 }),
      policy({ id: "a-policy", priority: 20 }),
      policy({ id: "low-policy", priority: 10 }),
    ];
    const engine = createAuthorizationEngine();
    const decisions = await Promise.all(
      Array.from({ length: 12 }, () => engine.evaluate(request(policies))),
    );
    expect(
      new Set(decisions.map((decision) => JSON.stringify(decision))).size,
    ).toBe(1);
    expect(decisions[0]?.policyId).toBe("a-policy");
  });

  it("evaluates valid policy conditions and denies when they do not match", async () => {
    const conditional = policy({
      conditions: { attribute: "state", operator: "equals", value: "DRAFT" },
    });
    await expect(
      createAuthorizationEngine().evaluate({
        ...request([conditional]),
        resourceAttributes: { conditionAttributes: { state: "DRAFT" } },
      }),
    ).resolves.toMatchObject({ decision: "ALLOW" });
    await expect(
      createAuthorizationEngine().evaluate({
        ...request([conditional]),
        resourceAttributes: { conditionAttributes: { state: "PUBLISHED" } },
      }),
    ).resolves.toMatchObject({
      decision: "DENY",
      reason: "CONDITION_NOT_MET",
    });
    await expect(
      createAuthorizationEngine().evaluate({
        ...request([conditional]),
        resourceAttributes: { conditionAttributes: {} },
      }),
    ).resolves.toMatchObject({
      decision: "DENY",
      reason: "MISSING_CONTEXT",
    });
  });

  it.each([
    ["unknown effect", { ...policy(), effect: "MAYBE" }, "INVALID_POLICY"],
    ["malformed policy", { id: "broken" }, "INVALID_POLICY"],
    [
      "unsupported condition",
      {
        ...policy(),
        conditions: { attribute: "state", operator: "eval", value: "x" },
      },
      "UNSUPPORTED_CONDITION",
    ],
  ] as const)("fails closed for %s", async (_label, candidate, reason) => {
    await expect(
      createAuthorizationEngine().evaluate(request([candidate])),
    ).resolves.toMatchObject({ decision: "DENY", reason });
  });

  it("fails closed for invalid and unknown permissions", async () => {
    await expect(
      createAuthorizationEngine().evaluate({
        ...request([policy()]),
        permission: "Curriculum.read",
      }),
    ).resolves.toMatchObject({
      decision: "DENY",
      reason: "INVALID_PERMISSION",
    });
    await expect(
      createAuthorizationEngine().evaluate({
        ...request([policy()]),
        permission: parsePermissionKey("curriculum.unknown"),
      }),
    ).resolves.toMatchObject({
      decision: "DENY",
      reason: "PERMISSION_MISMATCH",
    });
  });

  it("denies invalid scope, missing identity, and missing membership", async () => {
    const engine = createAuthorizationEngine();
    await expect(
      engine.evaluate({ ...request([policy()]), scope: { type: "LESSON" } }),
    ).resolves.toMatchObject({ decision: "DENY", reason: "INVALID_SCOPE" });
    await expect(
      engine.evaluate({ ...request([policy()]), context: undefined }),
    ).resolves.toMatchObject({ decision: "DENY", reason: "MISSING_CONTEXT" });
    await expect(
      engine.evaluate({
        ...request([policy()]),
        context: context({ memberships: [] }),
      }),
    ).resolves.toMatchObject({ decision: "DENY", reason: "MISSING_CONTEXT" });
    await expect(
      engine.evaluate({
        ...request([policy()]),
        resourceAttributes: {
          conditionAttributes: { unsafe: { nested: true } },
        } as unknown as ScopeEvaluationAttributes,
      }),
    ).resolves.toMatchObject({
      decision: "DENY",
      reason: "INVALID_SCOPE",
    });
  });

  it("rejects duplicate policy identities as malformed policy input", async () => {
    await expect(
      createAuthorizationEngine().evaluate(
        request([policy(), policy({ effect: "DENY" })]),
      ),
    ).resolves.toMatchObject({
      decision: "DENY",
      reason: "INVALID_POLICY",
    });
  });

  it("denies cross-tenant and forged own-resource scope", async () => {
    const engine = createAuthorizationEngine();
    await expect(
      engine.evaluate({
        ...request([policy()]),
        scope: {
          organizationId: "organization-2",
          resourceId: "curriculum-2",
          type: "CURRICULUM",
        },
      }),
    ).resolves.toMatchObject({ decision: "DENY" });

    await expect(
      engine.evaluate({
        ...request([
          policy({
            scope: { ...organizationScope, relationship: "OWN_RESOURCE" },
          }),
        ]),
        resourceAttributes: { resourceOwnerPersonId: "person-other" },
      }),
    ).resolves.toMatchObject({
      decision: "DENY",
      reason: "SCOPE_MISMATCH",
    });
  });

  it("does not mutate context, policies, scope, or resource attributes", async () => {
    const evaluation = {
      ...request([policy()]),
      resourceAttributes: {
        conditionAttributes: { state: "DRAFT" },
        lineage: { COURSE: "course-1" },
      },
    };
    const before = JSON.stringify(evaluation);
    await createAuthorizationEngine().evaluate(evaluation);
    expect(JSON.stringify(evaluation)).toBe(before);
  });

  it("converts known resolver domain errors to a fail-closed decision", async () => {
    const permissionResolver: PermissionResolver = {
      resolve: vi.fn(async () => {
        throw new AuthorizationError("PERMISSION_RESOLUTION_FAILED");
      }),
    };
    const policyResolver: PolicyResolver = {
      resolve: vi.fn(async () =>
        authorizationFailure(
          new AuthorizationError("POLICY_RESOLUTION_FAILED"),
        ),
      ),
    };
    const engine = new AuthorizationEngine({
      permissionResolver,
      policyResolver,
    });
    await expect(engine.evaluate(request([policy()]))).resolves.toMatchObject({
      decision: "DENY",
      reason: "INTERNAL_RESOLUTION_ERROR",
    });
  });

  it("does not swallow unexpected programmer errors", async () => {
    const permissionResolver: PermissionResolver = {
      resolve: vi.fn(async () => {
        throw new TypeError("programmer error");
      }),
    };
    const policyResolver: PolicyResolver = {
      resolve: vi.fn(async () =>
        authorizationSuccess({
          decision: "DENY",
          reason: "DEFAULT_DENY",
        } as const),
      ),
    };
    const engine = new AuthorizationEngine({
      permissionResolver,
      policyResolver,
    });
    await expect(engine.evaluate(request([policy()]))).rejects.toThrow(
      "programmer error",
    );
  });
});
