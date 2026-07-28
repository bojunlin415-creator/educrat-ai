import {
  curriculumToRecycleEntry,
  evaluateCurriculumPermanentDeletion,
  evaluateCurriculumRestore,
} from "@/lib/curriculum/recycle-bin";

vi.mock("server-only", () => ({}));

const deletedCurriculum = {
  deleted_at: "2026-07-28T04:00:00.000Z",
  deleted_by: "10000000-0000-4000-8000-000000000001",
  id: "10000000-0000-4000-8000-000000000009",
  latestVersion: 1,
  organization_id: "10000000-0000-4000-8000-000000000002",
};

describe("curriculum recycle bin adapter", () => {
  it("maps deleted curriculum data to an AP-002F recycle entry", () => {
    const entry = curriculumToRecycleEntry(deletedCurriculum, {
      hasProtectedDependencies: false,
    });

    expect(entry).toEqual(
      expect.objectContaining({
        dependencyReference: "NONE",
        lifecycleState: "TRASHED",
        permanentDeleteEligible: true,
        resourceType: "CURRICULUM",
        restoreEligible: true,
      }),
    );
    expect(Object.isFrozen(entry)).toBe(true);
  });

  it("allows restore for valid recycled curriculum entries", () => {
    const entry = curriculumToRecycleEntry(deletedCurriculum, {
      hasProtectedDependencies: false,
    });

    expect(
      evaluateCurriculumRestore({
        actorId: "10000000-0000-4000-8000-000000000001",
        entry,
      }),
    ).toEqual(expect.objectContaining({ allowed: true }));
  });

  it("blocks permanent deletion when protected dependencies exist", () => {
    const entry = curriculumToRecycleEntry(deletedCurriculum, {
      hasProtectedDependencies: true,
    });

    expect(
      evaluateCurriculumPermanentDeletion({
        actorId: "10000000-0000-4000-8000-000000000001",
        entry,
      }),
    ).toEqual(
      expect.objectContaining({
        allowed: false,
        reason: "RECYCLE_BIN_DEPENDENCY_NOT_SATISFIED",
      }),
    );
  });
});
