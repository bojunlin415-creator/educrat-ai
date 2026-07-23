import {
  DependencyError,
  type DependencyErrorCode,
  DependencyRegistry,
  validateDependencyCheckRequest,
  validateDependencyReferences,
} from "@/lib/dependency";

const registry = new DependencyRegistry({
  dependencyTypes: ["CONTAINS", "REFERENCES"],
  resourceTypes: ["ROOT", "CHILD", "HISTORY"],
  transitions: ["ARCHIVE", "DELETE"],
  version: 1,
});

function requestInput(): Record<string, unknown> {
  return {
    requestedTransition: "DELETE",
    resourceId: "root-1",
    resourceType: "ROOT",
    version: 1,
  };
}

function referenceInput(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    dependencyType: "CONTAINS",
    direction: "OUTBOUND",
    readonly: true,
    relatedResourceId: "child-1",
    relatedResourceType: "CHILD",
    resourceId: "root-1",
    resourceType: "ROOT",
    version: 1,
    ...overrides,
  };
}

function expectDependencyError(
  action: () => unknown,
  code: DependencyErrorCode,
): void {
  expect(action).toThrowError(
    expect.objectContaining<Partial<DependencyError>>({ code }),
  );
}

describe("dependency validation", () => {
  it("rejects unknown resources and transitions before graph lookup", () => {
    expectDependencyError(
      () =>
        validateDependencyCheckRequest(
          { ...requestInput(), resourceType: "UNKNOWN" },
          registry.definition,
        ),
      "UNKNOWN_DEPENDENCY_RESOURCE",
    );
    expectDependencyError(
      () =>
        validateDependencyCheckRequest(
          { ...requestInput(), requestedTransition: "RESTORE" },
          registry.definition,
        ),
      "UNKNOWN_DEPENDENCY_TRANSITION",
    );
  });

  it("rejects unknown fields, symbols, and accessors", () => {
    expectDependencyError(
      () =>
        validateDependencyCheckRequest(
          { ...requestInput(), token: "forbidden" },
          registry.definition,
        ),
      "INVALID_DEPENDENCY_INPUT",
    );
    const symbolInput = requestInput();
    Object.defineProperty(symbolInput, Symbol("hidden"), { value: true });
    expectDependencyError(
      () => validateDependencyCheckRequest(symbolInput, registry.definition),
      "INVALID_DEPENDENCY_INPUT",
    );
    const accessorInput = requestInput();
    Object.defineProperty(accessorInput, "resourceId", {
      enumerable: true,
      get: () => "root-1",
    });
    expectDependencyError(
      () => validateDependencyCheckRequest(accessorInput, registry.definition),
      "INVALID_DEPENDENCY_INPUT",
    );
  });

  it("rejects unknown dependency types and resource endpoints", () => {
    const request = validateDependencyCheckRequest(
      requestInput(),
      registry.definition,
    );
    expectDependencyError(
      () =>
        validateDependencyReferences(
          [referenceInput({ dependencyType: "UNKNOWN" })],
          request,
          registry.definition,
        ),
      "UNKNOWN_DEPENDENCY_TYPE",
    );
    expectDependencyError(
      () =>
        validateDependencyReferences(
          [referenceInput({ relatedResourceType: "UNKNOWN" })],
          request,
          registry.definition,
        ),
      "UNKNOWN_DEPENDENCY_RESOURCE",
    );
  });

  it("rejects duplicate directed dependency references", () => {
    const request = validateDependencyCheckRequest(
      requestInput(),
      registry.definition,
    );
    const outbound = referenceInput();
    const sameEdgeAsInbound = referenceInput({
      direction: "INBOUND",
      relatedResourceId: "root-1",
      relatedResourceType: "ROOT",
      resourceId: "child-1",
      resourceType: "CHILD",
    });

    expectDependencyError(
      () =>
        validateDependencyReferences(
          [outbound, sameEdgeAsInbound],
          request,
          registry.definition,
        ),
      "DUPLICATE_DEPENDENCY_REFERENCE",
    );
  });

  it("rejects direct and indirect circular dependencies", () => {
    const request = validateDependencyCheckRequest(
      requestInput(),
      registry.definition,
    );
    expectDependencyError(
      () =>
        validateDependencyReferences(
          [
            referenceInput({
              relatedResourceId: "root-1",
              relatedResourceType: "ROOT",
            }),
          ],
          request,
          registry.definition,
        ),
      "CIRCULAR_DEPENDENCY",
    );

    const cycle = [
      referenceInput(),
      referenceInput({
        dependencyType: "REFERENCES",
        relatedResourceId: "history-1",
        relatedResourceType: "HISTORY",
        resourceId: "child-1",
        resourceType: "CHILD",
      }),
      referenceInput({
        dependencyType: "REFERENCES",
        relatedResourceId: "root-1",
        relatedResourceType: "ROOT",
        resourceId: "history-1",
        resourceType: "HISTORY",
      }),
    ];
    expectDependencyError(
      () => validateDependencyReferences(cycle, request, registry.definition),
      "CIRCULAR_DEPENDENCY",
    );
  });

  it("rejects graph fragments disconnected from the requested resource", () => {
    const request = validateDependencyCheckRequest(
      requestInput(),
      registry.definition,
    );
    expectDependencyError(
      () =>
        validateDependencyReferences(
          [
            referenceInput({
              relatedResourceId: "history-1",
              relatedResourceType: "HISTORY",
              resourceId: "child-1",
              resourceType: "CHILD",
            }),
          ],
          request,
          registry.definition,
        ),
      "DISCONNECTED_DEPENDENCY_GRAPH",
    );
  });

  it("rejects unsupported versions and malformed resource identifiers", () => {
    expectDependencyError(
      () =>
        validateDependencyCheckRequest(
          { ...requestInput(), version: 2 },
          registry.definition,
        ),
      "UNSUPPORTED_DEPENDENCY_VERSION",
    );
    expectDependencyError(
      () =>
        validateDependencyCheckRequest(
          { ...requestInput(), resourceId: "student@example.test" },
          registry.definition,
        ),
      "INVALID_DEPENDENCY_INPUT",
    );
  });
});
