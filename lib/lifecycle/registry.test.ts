import {
  CORE_LIFECYCLE_DEFINITION,
  LifecycleRegistry,
  StaticLifecycleDefinitionProvider,
} from "@/lib/lifecycle";

describe("lifecycle registry", () => {
  it("registers validated definitions and supports read-only lookups", () => {
    const registry = new LifecycleRegistry(
      new StaticLifecycleDefinitionProvider([CORE_LIFECYCLE_DEFINITION]),
    );
    const definition = registry.getDefinition("CORE_RESOURCE", 1);

    expect(definition).not.toBeNull();
    expect(registry.getState(definition!, "ARCHIVED")?.isRestorable).toBe(true);
    expect(
      registry.getTransition(definition!, "ARCHIVED_TO_TRASHED")?.intent,
    ).toBe("TRASH");
    expect(registry.hasDefinition("CORE_RESOURCE", 1)).toBe(true);
  });

  it("takes an immutable snapshot of provider input", () => {
    const definitions: unknown[] = [CORE_LIFECYCLE_DEFINITION];
    const provider = new StaticLifecycleDefinitionProvider(definitions);
    definitions.length = 0;

    expect(provider.getDefinitions()).toHaveLength(1);
    expect(Object.isFrozen(provider.getDefinitions())).toBe(true);
  });

  it("rejects duplicate definitions and exposes no mutation methods", () => {
    expect(
      () =>
        new LifecycleRegistry({
          getDefinitions: () => [
            CORE_LIFECYCLE_DEFINITION,
            CORE_LIFECYCLE_DEFINITION,
          ],
        }),
    ).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_LIFECYCLE_DEFINITION" }),
    );

    const registry = new LifecycleRegistry(
      new StaticLifecycleDefinitionProvider([CORE_LIFECYCLE_DEFINITION]),
    );
    expect("update" in registry).toBe(false);
    expect("delete" in registry).toBe(false);
    expect("register" in registry).toBe(false);
  });
});
