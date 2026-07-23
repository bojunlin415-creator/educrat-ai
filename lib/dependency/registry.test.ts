import { DependencyError, DependencyRegistry } from "@/lib/dependency";

function createDefinition(): {
  dependencyTypes: string[];
  resourceTypes: string[];
  transitions: string[];
  version: number;
} {
  return {
    dependencyTypes: ["REFERENCES", "CONTAINS"],
    resourceTypes: ["ROOT", "CHILD"],
    transitions: ["DELETE", "ARCHIVE"],
    version: 1,
  };
}

describe("DependencyRegistry", () => {
  it("validates, sorts, and freezes a construction-time snapshot", () => {
    const source = createDefinition();
    const registry = new DependencyRegistry(source);
    source.resourceTypes.push("LATE_MUTATION");

    expect(registry.definition.resourceTypes).toEqual(["CHILD", "ROOT"]);
    expect(registry.hasResourceType("ROOT")).toBe(true);
    expect(registry.hasResourceType("LATE_MUTATION")).toBe(false);
    expect(registry.hasDependencyType("CONTAINS")).toBe(true);
    expect(registry.hasTransition("ARCHIVE")).toBe(true);
    expect(Object.isFrozen(registry.definition)).toBe(true);
    expect(Object.isFrozen(registry.definition.resourceTypes)).toBe(true);
  });

  it.each([
    ["resourceTypes", "DUPLICATE_DEPENDENCY_RESOURCE_TYPE"],
    ["dependencyTypes", "DUPLICATE_DEPENDENCY_TYPE"],
    ["transitions", "DUPLICATE_DEPENDENCY_TRANSITION"],
  ] as const)("rejects duplicate %s", (field, code) => {
    const source = createDefinition();
    source[field] = [source[field][0] ?? "VALUE", source[field][0] ?? "VALUE"];

    expect(() => new DependencyRegistry(source)).toThrowError(
      expect.objectContaining<Partial<DependencyError>>({ code }),
    );
  });

  it("does not expose runtime mutation methods", () => {
    const registry = new DependencyRegistry(createDefinition());

    expect("register" in registry).toBe(false);
    expect("update" in registry).toBe(false);
    expect("delete" in registry).toBe(false);
  });
});
