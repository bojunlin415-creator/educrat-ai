import {
  CORE_LIFECYCLE_DEFINITION,
  LifecycleError,
  validateLifecycleDefinition,
} from "@/lib/lifecycle";

function definitionWith(
  overrides: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown>> {
  return {
    definitionId: CORE_LIFECYCLE_DEFINITION.definitionId,
    states: CORE_LIFECYCLE_DEFINITION.states,
    transitions: CORE_LIFECYCLE_DEFINITION.transitions,
    version: CORE_LIFECYCLE_DEFINITION.version,
    ...overrides,
  };
}

describe("lifecycle definition validation", () => {
  it("accepts and copies the core definition", () => {
    const result = validateLifecycleDefinition(CORE_LIFECYCLE_DEFINITION);

    expect(result).toEqual(CORE_LIFECYCLE_DEFINITION);
    expect(result).not.toBe(CORE_LIFECYCLE_DEFINITION);
  });

  it("rejects duplicate states", () => {
    expect(() =>
      validateLifecycleDefinition(
        definitionWith({
          states: [
            ...CORE_LIFECYCLE_DEFINITION.states,
            CORE_LIFECYCLE_DEFINITION.states[0],
          ],
        }),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_LIFECYCLE_STATE" }),
    );
  });

  it("rejects transitions that reference an unknown state", () => {
    expect(() =>
      validateLifecycleDefinition(
        definitionWith({
          transitions: [
            {
              ...CORE_LIFECYCLE_DEFINITION.transitions[0],
              from: "UNKNOWN",
            },
          ],
        }),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "UNKNOWN_LIFECYCLE_STATE" }),
    );
  });

  it("rejects duplicate transition identifiers and routes", () => {
    const transition = CORE_LIFECYCLE_DEFINITION.transitions[0];
    expect(() =>
      validateLifecycleDefinition(
        definitionWith({ transitions: [transition, transition] }),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_LIFECYCLE_TRANSITION" }),
    );
    expect(() =>
      validateLifecycleDefinition(
        definitionWith({
          transitions: [
            transition,
            { ...transition, transitionId: "SAME_ROUTE" },
          ],
        }),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "DUPLICATE_LIFECYCLE_TRANSITION" }),
    );
  });

  it("rejects unknown intents and terminal outgoing transitions", () => {
    expect(() =>
      validateLifecycleDefinition(
        definitionWith({
          transitions: [
            {
              ...CORE_LIFECYCLE_DEFINITION.transitions[0],
              intent: "PURGE",
            },
          ],
        }),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "UNKNOWN_LIFECYCLE_INTENT" }),
    );

    expect(() =>
      validateLifecycleDefinition(
        definitionWith({
          transitions: [
            {
              ...CORE_LIFECYCLE_DEFINITION.transitions[0],
              from: "DELETED",
              transitionId: "DELETED_TO_PUBLISHED",
            },
          ],
        }),
      ),
    ).toThrowError(
      expect.objectContaining({
        code: "TERMINAL_STATE_HAS_OUTGOING_TRANSITION",
      }),
    );
  });

  it("rejects unsupported versions, unknown fields, and invalid requirements", () => {
    expect(() =>
      validateLifecycleDefinition(definitionWith({ version: 2 })),
    ).toThrowError(
      expect.objectContaining({ code: "UNSUPPORTED_LIFECYCLE_VERSION" }),
    );
    expect(() =>
      validateLifecycleDefinition({
        ...definitionWith(),
        unexpected: "field",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_LIFECYCLE_INPUT" }),
    );
    expect(() =>
      validateLifecycleDefinition(
        definitionWith({
          transitions: [
            {
              ...CORE_LIFECYCLE_DEFINITION.transitions[0],
              requirements: {
                ...CORE_LIFECYCLE_DEFINITION.transitions[0]?.requirements,
                token: "forbidden",
              },
            },
          ],
        }),
      ),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_LIFECYCLE_REQUIREMENTS" }),
    );
  });

  it("rejects accessors without evaluating them", () => {
    const getter = vi.fn(() => "CORE_RESOURCE");
    const input = Object.defineProperty(definitionWith(), "definitionId", {
      configurable: true,
      enumerable: true,
      get: getter,
    });

    expect(() => validateLifecycleDefinition(input)).toThrow(LifecycleError);
    expect(getter).not.toHaveBeenCalled();
  });
});
