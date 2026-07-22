import {
  CORE_LIFECYCLE_DEFINITION,
  LifecycleError,
  serializeLifecycleDefinition,
} from "@/lib/lifecycle";

describe("canonical lifecycle serialization", () => {
  it("returns the same payload for equivalent key ordering", () => {
    const reordered = {
      version: CORE_LIFECYCLE_DEFINITION.version,
      transitions: CORE_LIFECYCLE_DEFINITION.transitions.map((transition) => ({
        version: transition.version,
        transitionId: transition.transitionId,
        to: transition.to,
        requirements: {
          retentionRequired: transition.requirements.retentionRequired,
          reauthenticationRequired:
            transition.requirements.reauthenticationRequired,
          legalHoldRequired: transition.requirements.legalHoldRequired,
          dependencyCheckRequired:
            transition.requirements.dependencyCheckRequired,
          authorizationRequired: transition.requirements.authorizationRequired,
          auditRequired: transition.requirements.auditRequired,
        },
        intent: transition.intent,
        from: transition.from,
      })),
      states: CORE_LIFECYCLE_DEFINITION.states.map((state) => ({
        version: state.version,
        readonly: state.readonly,
        isTerminal: state.isTerminal,
        isRestorable: state.isRestorable,
        id: state.id,
        category: state.category,
      })),
      definitionId: CORE_LIFECYCLE_DEFINITION.definitionId,
    };

    expect(serializeLifecycleDefinition(reordered)).toBe(
      serializeLifecycleDefinition(CORE_LIFECYCLE_DEFINITION),
    );
  });

  it("preserves declared transition order as part of the definition", () => {
    const reversed = {
      ...CORE_LIFECYCLE_DEFINITION,
      transitions: [...CORE_LIFECYCLE_DEFINITION.transitions].reverse(),
    };

    expect(serializeLifecycleDefinition(reversed)).not.toBe(
      serializeLifecycleDefinition(CORE_LIFECYCLE_DEFINITION),
    );
  });

  it("rejects unknown fields and accessors before serialization", () => {
    expect(() =>
      serializeLifecycleDefinition({
        ...CORE_LIFECYCLE_DEFINITION,
        secret: "not-allowed",
      }),
    ).toThrow(LifecycleError);

    const getter = vi.fn(() => 1);
    const input = Object.defineProperty(
      { ...CORE_LIFECYCLE_DEFINITION },
      "version",
      { enumerable: true, get: getter },
    );
    expect(() => serializeLifecycleDefinition(input)).toThrow(LifecycleError);
    expect(getter).not.toHaveBeenCalled();
  });
});
