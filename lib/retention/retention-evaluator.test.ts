import {
  evaluateRetentionProtection,
  RetentionRegistry,
  type RetentionPolicy,
} from "@/lib/retention";

const registry = new RetentionRegistry({
  definitions: [
    {
      legalHoldSupported: true,
      metadata: [{ key: "SOURCE", value: "PLATFORM" }],
      minimumRetentionPeriod: { amount: 30, unit: "DAYS" },
      resourceType: "RECORD",
      retentionCategory: "BUSINESS",
      version: 1,
    },
  ],
  retentionCategories: ["BUSINESS"],
  transitions: ["DELETE"],
  version: 1,
});

const request = {
  requestedTransition: "DELETE",
  resourceId: "record-1",
  resourceType: "RECORD",
  version: 1,
};

const inactiveHold = {
  active: false,
  holdId: "hold-1",
  holdReason: "LEGAL_REVIEW",
  resourceId: "record-1",
  resourceType: "RECORD",
  version: 1,
};

const allowPolicy: RetentionPolicy = {
  evaluate: vi.fn<RetentionPolicy["evaluate"]>(() => ({ decision: "ALLOW" })),
};

describe("evaluateRetentionProtection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orchestrates validation, rule resolution, hold validation, and policy", () => {
    const result = evaluateRetentionProtection(
      { legalHolds: [inactiveHold], request },
      { policy: allowPolicy, registry },
    );

    expect(allowPolicy.evaluate).toHaveBeenCalledOnce();
    expect(result).toEqual({
      decision: "ALLOWED",
      evaluation: {
        activeLegalHoldCount: 0,
        legalHoldCount: 1,
        policyDecision: "ALLOW",
        validation: "PASSED",
      },
      requirements: {
        legalHoldCheck: "PASSED",
        metadata: [{ key: "SOURCE", value: "PLATFORM" }],
        minimumRetentionPeriod: { amount: 30, unit: "DAYS" },
        retentionCategory: "BUSINESS",
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("denies an active legal hold before policy evaluation", () => {
    const result = evaluateRetentionProtection(
      { legalHolds: [{ ...inactiveHold, active: true }], request },
      { policy: allowPolicy, registry },
    );

    expect(result).toEqual({
      decision: "DENIED",
      denialCode: "LEGAL_HOLD_ACTIVE",
      reason: "LEGAL_HOLD_IS_ACTIVE",
    });
    expect(allowPolicy.evaluate).not.toHaveBeenCalled();
  });

  it("denies invalid requests and holds before policy evaluation", () => {
    const scenarios = [
      {
        expected: ["UNKNOWN_RESOURCE", "RETENTION_RESOURCE_NOT_REGISTERED"],
        input: {
          legalHolds: [],
          request: { ...request, resourceType: "OTHER" },
        },
      },
      {
        expected: ["INVALID_HOLD", "LEGAL_HOLD_INVALID"],
        input: {
          legalHolds: [{ ...inactiveHold, resourceId: "other-1" }],
          request,
        },
      },
      {
        expected: ["INVALID_REQUEST", "INVALID_RETENTION_REQUEST"],
        input: { legalHolds: [], request, token: "forbidden" },
      },
    ] as const;

    for (const scenario of scenarios) {
      const result = evaluateRetentionProtection(scenario.input, {
        policy: allowPolicy,
        registry,
      });
      expect(result).toMatchObject({
        decision: "DENIED",
        denialCode: scenario.expected[0],
        reason: scenario.expected[1],
      });
    }
    expect(allowPolicy.evaluate).not.toHaveBeenCalled();
  });

  it("returns an immutable policy denial", () => {
    const policy: RetentionPolicy = {
      evaluate: vi.fn<RetentionPolicy["evaluate"]>(() => ({
        decision: "DENY",
        reason: "RETENTION_POLICY_DENIED",
      })),
    };
    const result = evaluateRetentionProtection(
      { legalHolds: [], request },
      { policy, registry },
    );

    expect(result).toEqual({
      decision: "DENIED",
      denialCode: "POLICY_DENIED",
      reason: "RETENTION_POLICY_DENIED",
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it.each([
    [
      "throws",
      vi.fn(() => {
        throw new Error("policy failure");
      }),
    ],
    ["returns an invalid result", vi.fn(() => ({ decision: "UNKNOWN" }))],
  ])("fails closed when policy %s", (_label, evaluate) => {
    const result = evaluateRetentionProtection(
      { legalHolds: [], request },
      { policy: { evaluate } as RetentionPolicy, registry },
    );

    expect(result).toEqual({
      decision: "DENIED",
      denialCode: "POLICY_ERROR",
      reason: "RETENTION_POLICY_EVALUATION_FAILED",
    });
  });
});
