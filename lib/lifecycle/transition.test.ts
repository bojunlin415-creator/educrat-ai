import { CORE_LIFECYCLE_DEFINITION } from "@/lib/lifecycle";

describe("lifecycle transition model", () => {
  it("registers only the six explicit foundation transitions", () => {
    expect(
      CORE_LIFECYCLE_DEFINITION.transitions.map((transition) =>
        [transition.from, transition.to, transition.intent].join(":"),
      ),
    ).toEqual([
      "DRAFT:PUBLISHED:PUBLISH",
      "PUBLISHED:ARCHIVED:ARCHIVE",
      "ARCHIVED:PUBLISHED:RESTORE",
      "ARCHIVED:TRASHED:TRASH",
      "TRASHED:ARCHIVED:RESTORE",
      "TRASHED:DELETED:DELETE",
    ]);
  });

  it("describes safeguards without executing them", () => {
    const irreversible = CORE_LIFECYCLE_DEFINITION.transitions.find(
      (transition) => transition.transitionId === "TRASHED_TO_DELETED",
    );

    expect(irreversible?.requirements).toEqual({
      auditRequired: true,
      authorizationRequired: true,
      dependencyCheckRequired: true,
      legalHoldRequired: true,
      reauthenticationRequired: true,
      retentionRequired: true,
    });
  });

  it("contains no implicit direct jump from draft to deleted", () => {
    expect(
      CORE_LIFECYCLE_DEFINITION.transitions.some(
        (transition) =>
          transition.from === "DRAFT" && transition.to === "DELETED",
      ),
    ).toBe(false);
  });
});
