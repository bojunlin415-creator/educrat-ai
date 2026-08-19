import {
  readClassRosterByAuthority,
  resolveClassRosterAuthorityMode,
} from "@/lib/learner-convergence/class-roster/authority";
import type {
  ClassRosterAuthorityEvent,
  ClassRosterSource,
  ClassRosterStudentProjection,
} from "@/lib/learner-convergence/class-roster/domain";
import { ClassRosterSourceError } from "@/lib/learner-convergence/class-roster/errors";

const entry: ClassRosterStudentProjection = {
  classId: "10000000-0000-4000-8000-000000000010",
  englishName: null,
  grade: "五年級",
  joinedAt: "2026-08-19T00:00:00.000Z",
  leftAt: null,
  membershipId: "10000000-0000-4000-8000-000000000020",
  membershipStatus: "active",
  name: "測試學生",
  organizationId: "10000000-0000-4000-8000-000000000030",
  studentId: "10000000-0000-4000-8000-000000000040",
  studentNo: "S-001",
  studentStatus: "active",
};

function setup(input?: { readonly canonicalFailure?: boolean }) {
  const canonical = vi.fn(async () => {
    if (input?.canonicalFailure) {
      throw new ClassRosterSourceError("CANONICAL_RUNTIME_FAILURE");
    }
    return [entry];
  });
  const legacy = vi.fn(async () => [{ ...entry, studentId: null }]);
  const events: ClassRosterAuthorityEvent[] = [];
  const source: ClassRosterSource = {
    loadCanonical: canonical,
    loadLegacy: legacy,
  };
  return {
    canonical,
    events,
    legacy,
    observer: {
      record: (event: ClassRosterAuthorityEvent) => events.push(event),
    },
    source,
  };
}

async function read(
  mode:
    | "CANONICAL_ONLY"
    | "CANONICAL_PRIMARY_LEGACY_FALLBACK"
    | "LEGACY_ONLY"
    | "LEGACY_PRIMARY_CANONICAL_SHADOW",
  configured = setup(),
) {
  return {
    configured,
    result: await readClassRosterByAuthority({
      actorRole: "organization_owner",
      classId: entry.classId,
      correlationId: "phase-5a-test",
      mode,
      observer: configured.observer,
      organizationId: entry.organizationId,
      source: configured.source,
    }),
  };
}

describe("LE-001 Phase 5A class roster authority", () => {
  it("supports independently testable legacy, shadow, primary, and canonical modes", async () => {
    const legacy = await read("LEGACY_ONLY");
    expect(legacy.result.authority).toBe("LEGACY");
    expect(legacy.configured.canonical).not.toHaveBeenCalled();

    const shadow = await read("LEGACY_PRIMARY_CANONICAL_SHADOW");
    expect(shadow.result.authority).toBe("LEGACY");
    expect(shadow.configured.legacy).toHaveBeenCalledOnce();
    expect(shadow.configured.canonical).toHaveBeenCalledOnce();

    const primary = await read("CANONICAL_PRIMARY_LEGACY_FALLBACK");
    expect(primary.result.authority).toBe("CANONICAL");
    expect(primary.configured.legacy).not.toHaveBeenCalled();

    const canonical = await read("CANONICAL_ONLY");
    expect(canonical.result.authority).toBe("CANONICAL");
    expect(canonical.configured.legacy).not.toHaveBeenCalled();
  });

  it("falls back only after a canonical runtime failure", async () => {
    const configured = setup({ canonicalFailure: true });
    const output = await read("CANONICAL_PRIMARY_LEGACY_FALLBACK", configured);
    expect(output.result).toMatchObject({
      authority: "LEGACY",
      fallbackUsed: true,
      legacyCount: 1,
    });
    expect(output.configured.events[0]).toMatchObject({
      fallbackReason: "canonical_read_failure",
      fallbackUsed: true,
    });
  });

  it("does not fallback for a valid empty canonical roster or in canonical-only mode", async () => {
    const empty = setup();
    empty.canonical.mockResolvedValue([]);
    const output = await read("CANONICAL_PRIMARY_LEGACY_FALLBACK", empty);
    expect(output.result).toMatchObject({
      authority: "CANONICAL",
      canonicalCount: 0,
      fallbackUsed: false,
    });
    expect(empty.legacy).not.toHaveBeenCalled();

    await expect(
      read("CANONICAL_ONLY", setup({ canonicalFailure: true })),
    ).rejects.toThrow("canonical_runtime_failure");
  });

  it("does not fallback for a canonical integrity or authorization failure", async () => {
    const configured = setup();
    configured.canonical.mockRejectedValue(
      new ClassRosterSourceError("CANONICAL_INTEGRITY_FAILURE"),
    );
    await expect(
      read("CANONICAL_PRIMARY_LEGACY_FALLBACK", configured),
    ).rejects.toThrow("canonical_integrity_failure");
    expect(configured.legacy).not.toHaveBeenCalled();
  });

  it("rolls back to legacy-only without a data mutation", async () => {
    const primary = await read("CANONICAL_PRIMARY_LEGACY_FALLBACK");
    const rollback = await read("LEGACY_ONLY");
    expect(primary.result.authority).toBe("CANONICAL");
    expect(rollback.result.authority).toBe("LEGACY");
    expect(rollback.configured.canonical).not.toHaveBeenCalled();
  });

  it("fails an unknown operational override safely to legacy-only", () => {
    expect(
      resolveClassRosterAuthorityMode({
        configuredMode: "UNKNOWN",
        selectedMode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
      }),
    ).toBe("LEGACY_ONLY");
    expect(
      resolveClassRosterAuthorityMode({
        selectedMode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
      }),
    ).toBe("CANONICAL_PRIMARY_LEGACY_FALLBACK");
  });

  it("freezes the returned roster projection", async () => {
    const output = await read("CANONICAL_ONLY");
    expect(Object.isFrozen(output.result)).toBe(true);
    expect(Object.isFrozen(output.result.entries)).toBe(true);
    expect(Object.isFrozen(output.result.entries[0])).toBe(true);
  });
});
