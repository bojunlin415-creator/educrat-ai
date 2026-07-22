import { CORE_LIFECYCLE_DEFINITION } from "@/lib/lifecycle";

describe("lifecycle state model", () => {
  it("defines the five foundation states with stable categories", () => {
    expect(
      CORE_LIFECYCLE_DEFINITION.states.map((state) => [
        state.id,
        state.category,
      ]),
    ).toEqual([
      ["DRAFT", "WORKING"],
      ["PUBLISHED", "RELEASED"],
      ["ARCHIVED", "INACTIVE"],
      ["TRASHED", "REMOVAL"],
      ["DELETED", "TERMINAL"],
    ]);
  });

  it("marks restoration, readonly, and terminal behavior explicitly", () => {
    const states = Object.fromEntries(
      CORE_LIFECYCLE_DEFINITION.states.map((state) => [state.id, state]),
    );

    expect(states.DRAFT).toMatchObject({
      isRestorable: false,
      isTerminal: false,
      readonly: false,
    });
    expect(states.ARCHIVED).toMatchObject({
      isRestorable: true,
      isTerminal: false,
      readonly: true,
    });
    expect(states.TRASHED).toMatchObject({
      isRestorable: true,
      isTerminal: false,
      readonly: true,
    });
    expect(states.DELETED).toMatchObject({
      isRestorable: false,
      isTerminal: true,
      readonly: true,
    });
  });

  it("freezes definitions, states, transitions, and requirements", () => {
    expect(Object.isFrozen(CORE_LIFECYCLE_DEFINITION)).toBe(true);
    expect(Object.isFrozen(CORE_LIFECYCLE_DEFINITION.states)).toBe(true);
    expect(Object.isFrozen(CORE_LIFECYCLE_DEFINITION.states[0])).toBe(true);
    expect(Object.isFrozen(CORE_LIFECYCLE_DEFINITION.transitions)).toBe(true);
    expect(Object.isFrozen(CORE_LIFECYCLE_DEFINITION.transitions[0])).toBe(
      true,
    );
    expect(
      Object.isFrozen(CORE_LIFECYCLE_DEFINITION.transitions[0]?.requirements),
    ).toBe(true);
  });
});
