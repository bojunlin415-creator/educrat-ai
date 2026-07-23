import {
  DependencyRegistry,
  evaluateDependencyProtection,
  type DependencyGraph,
  type DependencyPolicy,
} from "@/lib/dependency";

const registry = new DependencyRegistry({
  dependencyTypes: ["CONTAINS"],
  resourceTypes: ["ROOT", "CHILD"],
  transitions: ["DELETE"],
  version: 1,
});

const request = {
  requestedTransition: "DELETE",
  resourceId: "root-1",
  resourceType: "ROOT",
  version: 1,
};

const reference = {
  dependencyType: "CONTAINS",
  direction: "OUTBOUND",
  readonly: true,
  relatedResourceId: "child-1",
  relatedResourceType: "CHILD",
  resourceId: "root-1",
  resourceType: "ROOT",
  version: 1,
};

function graphReturning(value: readonly unknown[]): DependencyGraph {
  return {
    findDependencies: vi.fn(async () => value),
  };
}

const allowPolicy: DependencyPolicy = {
  evaluate: vi.fn<DependencyPolicy["evaluate"]>(() => ({
    decision: "ALLOW",
  })),
};

describe("evaluateDependencyProtection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orchestrates validation, graph lookup, policy, and an immutable allow result", async () => {
    const graph = graphReturning([reference]);
    const result = await evaluateDependencyProtection(request, {
      graph,
      policy: allowPolicy,
      registry,
    });

    expect(graph.findDependencies).toHaveBeenCalledOnce();
    expect(allowPolicy.evaluate).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      decision: "ALLOWED",
      evaluation: {
        dependencyCount: 1,
        readonlyDependencyCount: 1,
        validation: "PASSED",
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("denies before graph lookup for an invalid or unknown request", async () => {
    const graph = graphReturning([]);
    const result = await evaluateDependencyProtection(
      { ...request, requestedTransition: "UNKNOWN" },
      { graph, policy: allowPolicy, registry },
    );

    expect(result).toEqual({
      decision: "DENIED",
      denialCode: "UNKNOWN_TRANSITION",
      reason: "DEPENDENCY_TRANSITION_NOT_REGISTERED",
    });
    expect(graph.findDependencies).not.toHaveBeenCalled();
    expect(allowPolicy.evaluate).not.toHaveBeenCalled();
  });

  it("fails closed when graph lookup throws", async () => {
    const graph: DependencyGraph = {
      findDependencies: vi.fn(async () => {
        throw new Error("unavailable");
      }),
    };
    const result = await evaluateDependencyProtection(request, {
      graph,
      policy: allowPolicy,
      registry,
    });

    expect(result).toEqual({
      decision: "DENIED",
      denialCode: "GRAPH_ERROR",
      reason: "DEPENDENCY_GRAPH_LOOKUP_FAILED",
    });
    expect(allowPolicy.evaluate).not.toHaveBeenCalled();
  });

  it("fails closed on forged, duplicate, and circular graph results", async () => {
    const scenarios = [
      {
        expected: ["UNKNOWN_DEPENDENCY", "DEPENDENCY_TYPE_NOT_REGISTERED"],
        value: [{ ...reference, dependencyType: "UNKNOWN" }],
      },
      {
        expected: ["DUPLICATE_DEPENDENCY", "DUPLICATE_DEPENDENCY_DETECTED"],
        value: [reference, reference],
      },
      {
        expected: ["CIRCULAR_DEPENDENCY", "CIRCULAR_DEPENDENCY_DETECTED"],
        value: [
          {
            ...reference,
            relatedResourceId: "root-1",
            relatedResourceType: "ROOT",
          },
        ],
      },
    ] as const;

    for (const scenario of scenarios) {
      const result = await evaluateDependencyProtection(request, {
        graph: graphReturning(scenario.value),
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

  it("returns a policy denial without executing a write", async () => {
    const policy: DependencyPolicy = {
      evaluate: vi.fn<DependencyPolicy["evaluate"]>(() => ({
        decision: "DENY",
        reason: "DEPENDENCY_POLICY_DENIED",
      })),
    };
    const result = await evaluateDependencyProtection(request, {
      graph: graphReturning([reference]),
      policy,
      registry,
    });

    expect(result).toEqual({
      decision: "DENIED",
      denialCode: "POLICY_DENIED",
      reason: "DEPENDENCY_POLICY_DENIED",
    });
  });

  it.each([
    [
      "throws",
      vi.fn(() => {
        throw new Error("policy failure");
      }),
    ],
    ["returns an invalid result", vi.fn(() => ({ decision: "UNKNOWN" }))],
  ])("fails closed when policy %s", async (_label, evaluate) => {
    const result = await evaluateDependencyProtection(request, {
      graph: graphReturning([]),
      policy: { evaluate } as DependencyPolicy,
      registry,
    });

    expect(result).toEqual({
      decision: "DENIED",
      denialCode: "POLICY_ERROR",
      reason: "DEPENDENCY_POLICY_EVALUATION_FAILED",
    });
  });
});
