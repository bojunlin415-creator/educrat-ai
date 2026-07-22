import {
  CORE_LIFECYCLE_DEFINITION,
  LifecycleRegistry,
  StaticLifecycleDefinitionProvider,
  createAllowedLifecycleDecision,
  createDeniedLifecycleDecision,
} from "@/lib/lifecycle";

describe("lifecycle decision model", () => {
  const registry = new LifecycleRegistry(
    new StaticLifecycleDefinitionProvider([CORE_LIFECYCLE_DEFINITION]),
  );
  const definition = registry.getDefinition("CORE_RESOURCE", 1);

  it("creates an immutable allowed decision with complete transition context", () => {
    expect(definition).not.toBeNull();
    const currentState = registry.getState(definition!, "DRAFT");
    const targetState = registry.getState(definition!, "PUBLISHED");
    const transition = registry.getTransition(
      definition!,
      "DRAFT_TO_PUBLISHED",
    );
    expect(currentState).not.toBeNull();
    expect(targetState).not.toBeNull();
    expect(transition).not.toBeNull();

    const decision = createAllowedLifecycleDecision(
      currentState!,
      targetState!,
      transition!,
    );

    expect(decision).toMatchObject({
      currentState: { id: "DRAFT" },
      decision: "ALLOWED",
      targetState: { id: "PUBLISHED" },
      transition: { transitionId: "DRAFT_TO_PUBLISHED" },
    });
    expect(Object.isFrozen(decision)).toBe(true);
  });

  it("creates a minimal immutable denied decision", () => {
    const decision = createDeniedLifecycleDecision(
      "POLICY_DENIED",
      "LIFECYCLE_POLICY_DENIED",
    );

    expect(decision).toEqual({
      decision: "DENIED",
      denialCode: "POLICY_DENIED",
      reason: "LIFECYCLE_POLICY_DENIED",
    });
    expect(Object.isFrozen(decision)).toBe(true);
    expect("transition" in decision).toBe(false);
  });
});
