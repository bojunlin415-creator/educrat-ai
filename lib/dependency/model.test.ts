import {
  createAllowedDependencyCheckResult,
  createDeniedDependencyCheckResult,
  validateDependencyCheckRequest,
  validateDependencyDefinition,
  validateDependencyReferences,
} from "@/lib/dependency";

const definition = validateDependencyDefinition({
  dependencyTypes: ["CONTAINS", "REFERENCES"],
  resourceTypes: ["ROOT", "CHILD"],
  transitions: ["ARCHIVE", "DELETE"],
  version: 1,
});

const request = validateDependencyCheckRequest(
  {
    requestedTransition: "DELETE",
    resourceId: "root-1",
    resourceType: "ROOT",
    version: 1,
  },
  definition,
);

describe("dependency model", () => {
  it("creates runtime-frozen dependency references", () => {
    const dependencies = validateDependencyReferences(
      [
        {
          dependencyType: "CONTAINS",
          direction: "OUTBOUND",
          readonly: true,
          relatedResourceId: "child-1",
          relatedResourceType: "CHILD",
          resourceId: "root-1",
          resourceType: "ROOT",
          version: 1,
        },
      ],
      request,
      definition,
    );

    expect(Object.isFrozen(dependencies)).toBe(true);
    expect(Object.isFrozen(dependencies[0])).toBe(true);
    expect(dependencies[0]).toEqual({
      dependencyType: "CONTAINS",
      direction: "OUTBOUND",
      readonly: true,
      relatedResourceId: "child-1",
      relatedResourceType: "CHILD",
      resourceId: "root-1",
      resourceType: "ROOT",
      version: 1,
    });
  });

  it("creates immutable allowed results and evaluation summaries", () => {
    const dependencies = validateDependencyReferences([], request, definition);
    const result = createAllowedDependencyCheckResult(dependencies);

    expect(result).toEqual({
      decision: "ALLOWED",
      dependencies: [],
      evaluation: {
        dependencyCount: 0,
        policyDecision: "ALLOW",
        readonlyDependencyCount: 0,
        validation: "PASSED",
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.evaluation)).toBe(true);
  });

  it("creates immutable denied results without returning dependencies", () => {
    const result = createDeniedDependencyCheckResult(
      "POLICY_DENIED",
      "DEPENDENCY_POLICY_DENIED",
    );

    expect(result).toEqual({
      decision: "DENIED",
      denialCode: "POLICY_DENIED",
      reason: "DEPENDENCY_POLICY_DENIED",
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect("dependencies" in result).toBe(false);
  });
});
