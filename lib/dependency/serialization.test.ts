import {
  DependencyError,
  DependencyRegistry,
  serializeDependencySnapshot,
} from "@/lib/dependency";

const registry = new DependencyRegistry({
  dependencyTypes: ["CONTAINS", "REFERENCES"],
  resourceTypes: ["ROOT", "CHILD", "HISTORY"],
  transitions: ["DELETE"],
  version: 1,
});

const request = {
  requestedTransition: "DELETE",
  resourceId: "root-1",
  resourceType: "ROOT",
  version: 1,
};

const dependencyOne = {
  dependencyType: "CONTAINS",
  direction: "OUTBOUND",
  readonly: true,
  relatedResourceId: "child-1",
  relatedResourceType: "CHILD",
  resourceId: "root-1",
  resourceType: "ROOT",
  version: 1,
};

const dependencyTwo = {
  dependencyType: "REFERENCES",
  direction: "OUTBOUND",
  readonly: false,
  relatedResourceId: "history-1",
  relatedResourceType: "HISTORY",
  resourceId: "child-1",
  resourceType: "CHILD",
  version: 1,
};

describe("canonical dependency serialization", () => {
  it("is deterministic across object key and graph result ordering", () => {
    const first = serializeDependencySnapshot(
      { dependencies: [dependencyTwo, dependencyOne], request },
      registry.definition,
    );
    const second = serializeDependencySnapshot(
      {
        request: {
          version: 1,
          resourceType: "ROOT",
          resourceId: "root-1",
          requestedTransition: "DELETE",
        },
        dependencies: [dependencyOne, dependencyTwo],
      },
      registry.definition,
    );

    expect(first).toBe(second);
    expect(first).toBe(
      '{"dependencies":[{"dependencyType":"REFERENCES","direction":"OUTBOUND","readonly":false,"relatedResourceId":"history-1","relatedResourceType":"HISTORY","resourceId":"child-1","resourceType":"CHILD","version":1},{"dependencyType":"CONTAINS","direction":"OUTBOUND","readonly":true,"relatedResourceId":"child-1","relatedResourceType":"CHILD","resourceId":"root-1","resourceType":"ROOT","version":1}],"request":{"requestedTransition":"DELETE","resourceId":"root-1","resourceType":"ROOT","version":1}}',
    );
  });

  it("fails closed on unknown snapshot fields", () => {
    expect(() =>
      serializeDependencySnapshot(
        { dependencies: [], request, token: "forbidden" },
        registry.definition,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<DependencyError>>({
        code: "INVALID_DEPENDENCY_INPUT",
      }),
    );
  });
});
