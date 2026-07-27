import { RetentionError, RetentionRegistry } from "@/lib/retention";

function createRegistryDefinition(): {
  definitions: Array<{
    legalHoldSupported: boolean;
    metadata: Array<{ key: string; value: string }>;
    minimumRetentionPeriod: { amount: number; unit: string };
    resourceType: string;
    retentionCategory: string;
    version: number;
  }>;
  retentionCategories: string[];
  transitions: string[];
  version: number;
} {
  return {
    definitions: [
      {
        legalHoldSupported: true,
        metadata: [
          { key: "SOURCE", value: "PLATFORM" },
          { key: "CLASSIFICATION", value: "STANDARD" },
        ],
        minimumRetentionPeriod: { amount: 12, unit: "MONTHS" },
        resourceType: "RECORD",
        retentionCategory: "BUSINESS",
        version: 1,
      },
    ],
    retentionCategories: ["SECURITY", "BUSINESS"],
    transitions: ["DELETE", "ARCHIVE"],
    version: 1,
  };
}

describe("RetentionRegistry", () => {
  it("validates, sorts, copies, and freezes its construction-time snapshot", () => {
    const source = createRegistryDefinition();
    const registry = new RetentionRegistry(source);
    source.transitions.push("LATE_MUTATION");
    source.definitions[0]?.metadata.push({
      key: "LATE_MUTATION",
      value: "FORBIDDEN",
    });

    expect(registry.definition.retentionCategories).toEqual([
      "BUSINESS",
      "SECURITY",
    ]);
    expect(registry.definition.transitions).toEqual(["ARCHIVE", "DELETE"]);
    expect(registry.getDefinition("RECORD")?.metadata).toEqual([
      { key: "CLASSIFICATION", value: "STANDARD" },
      { key: "SOURCE", value: "PLATFORM" },
    ]);
    expect(registry.hasResourceType("RECORD")).toBe(true);
    expect(registry.hasRetentionCategory("BUSINESS")).toBe(true);
    expect(registry.hasTransition("ARCHIVE")).toBe(true);
    expect(registry.hasTransition("LATE_MUTATION")).toBe(false);
    expect(Object.isFrozen(registry.definition)).toBe(true);
    expect(Object.isFrozen(registry.definition.definitions)).toBe(true);
  });

  it.each([
    ["retentionCategories", "DUPLICATE_RETENTION_CATEGORY"],
    ["transitions", "DUPLICATE_RETENTION_TRANSITION"],
  ] as const)("rejects duplicate %s", (field, code) => {
    const source = createRegistryDefinition();
    source[field] = [source[field][0] ?? "VALUE", source[field][0] ?? "VALUE"];

    expect(() => new RetentionRegistry(source)).toThrowError(
      expect.objectContaining<Partial<RetentionError>>({ code }),
    );
  });

  it("rejects duplicate resource definitions", () => {
    const source = createRegistryDefinition();
    const first = source.definitions[0];
    if (!first) throw new Error("Test fixture requires a definition");
    source.definitions.push({
      ...first,
      metadata: [...first.metadata],
      minimumRetentionPeriod: { ...first.minimumRetentionPeriod },
    });

    expect(() => new RetentionRegistry(source)).toThrowError(
      expect.objectContaining<Partial<RetentionError>>({
        code: "DUPLICATE_RETENTION_RESOURCE",
      }),
    );
  });

  it("does not expose runtime mutation methods", () => {
    const registry = new RetentionRegistry(createRegistryDefinition());

    expect("register" in registry).toBe(false);
    expect("update" in registry).toBe(false);
    expect("delete" in registry).toBe(false);
  });
});
