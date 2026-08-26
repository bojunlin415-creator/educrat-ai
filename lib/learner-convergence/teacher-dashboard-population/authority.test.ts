import type {
  ClassRosterSource,
  ClassRosterStudentProjection,
} from "@/lib/learner-convergence/class-roster/domain";
import { ClassRosterSourceError } from "@/lib/learner-convergence/class-roster/errors";
import {
  readTeacherDashboardPopulationByAuthority,
  resolveTeacherDashboardPopulationAuthorityMode,
} from "@/lib/learner-convergence/teacher-dashboard-population/authority";
import type { TeacherDashboardPopulationAuthorityEvent } from "@/lib/learner-convergence/teacher-dashboard-population/domain";

const canonicalEntry: ClassRosterStudentProjection = Object.freeze({
  classId: "10000000-0000-4000-8000-000000000010",
  englishName: null,
  grade: "五年級",
  joinedAt: "2026-08-20T00:00:00.000Z",
  leftAt: null,
  membershipId: "10000000-0000-4000-8000-000000000020",
  membershipStatus: "active",
  name: "受管理學生",
  organizationId: "10000000-0000-4000-8000-000000000030",
  studentId: "10000000-0000-4000-8000-000000000040",
  studentNo: "S-001",
  studentStatus: "active",
});

function setup() {
  const canonical = vi.fn(async () => [canonicalEntry]);
  const legacy = vi.fn(async () => [
    Object.freeze({ ...canonicalEntry, name: null, studentId: null }),
  ]);
  const events: TeacherDashboardPopulationAuthorityEvent[] = [];
  const source: ClassRosterSource = {
    loadCanonical: canonical,
    loadLegacy: legacy,
  };
  return {
    canonical,
    events,
    legacy,
    observer: {
      record: (event: TeacherDashboardPopulationAuthorityEvent) =>
        events.push(event),
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
    result: await readTeacherDashboardPopulationByAuthority({
      actorRole: "teacher",
      classCount: 1,
      correlationId: "phase-5b-authority-test",
      mode,
      observer: configured.observer,
      organizationId: canonicalEntry.organizationId,
      source: configured.source,
    }),
  };
}

describe("LE-001 Phase 5B Teacher Dashboard population authority", () => {
  it("supports all four authority modes without coupling to other consumers", async () => {
    const legacy = await read("LEGACY_ONLY");
    expect(legacy.result.authority).toBe("LEGACY");
    expect(legacy.configured.canonical).not.toHaveBeenCalled();

    const shadow = await read("LEGACY_PRIMARY_CANONICAL_SHADOW");
    expect(shadow.result.authority).toBe("LEGACY");
    expect(shadow.configured.canonical).toHaveBeenCalledOnce();

    const primary = await read("CANONICAL_PRIMARY_LEGACY_FALLBACK");
    expect(primary.result.authority).toBe("CANONICAL");
    expect(primary.configured.legacy).not.toHaveBeenCalled();

    const canonical = await read("CANONICAL_ONLY");
    expect(canonical.result.authority).toBe("CANONICAL");
    expect(canonical.configured.legacy).not.toHaveBeenCalled();
  });

  it("falls back only for a genuine canonical runtime failure", async () => {
    const configured = setup();
    configured.canonical.mockRejectedValue(
      new ClassRosterSourceError("CANONICAL_RUNTIME_FAILURE"),
    );
    const output = await read("CANONICAL_PRIMARY_LEGACY_FALLBACK", configured);

    expect(output.result).toMatchObject({
      authority: "LEGACY",
      fallbackUsed: true,
      legacyPopulationCount: 1,
    });
    expect(configured.events[0]).toMatchObject({
      fallbackReason: "canonical_read_failure",
      fallbackUsed: true,
    });
  });

  it("does not fallback for empty, integrity, authorization, or tenant outcomes", async () => {
    const empty = setup();
    empty.canonical.mockResolvedValue([]);
    await expect(
      read("CANONICAL_PRIMARY_LEGACY_FALLBACK", empty),
    ).resolves.toMatchObject({
      result: {
        authority: "CANONICAL",
        canonicalPopulationCount: 0,
        fallbackUsed: false,
      },
    });
    expect(empty.legacy).not.toHaveBeenCalled();

    for (const code of ["CANONICAL_INTEGRITY_FAILURE"] as const) {
      const configured = setup();
      configured.canonical.mockRejectedValue(new ClassRosterSourceError(code));
      await expect(
        read("CANONICAL_PRIMARY_LEGACY_FALLBACK", configured),
      ).rejects.toMatchObject({ code });
      expect(configured.legacy).not.toHaveBeenCalled();
    }
  });

  it("provides deterministic rollback and fails an invalid override to legacy-only", async () => {
    expect(
      resolveTeacherDashboardPopulationAuthorityMode({
        configuredMode: "UNKNOWN",
        selectedMode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
      }),
    ).toBe("LEGACY_ONLY");
    expect(
      resolveTeacherDashboardPopulationAuthorityMode({
        selectedMode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
      }),
    ).toBe("CANONICAL_PRIMARY_LEGACY_FALLBACK");

    const rollback = await read("LEGACY_ONLY");
    expect(rollback.result.authority).toBe("LEGACY");
    expect(rollback.configured.canonical).not.toHaveBeenCalled();
  });

  it("returns and observes immutable, non-content authority metadata", async () => {
    const output = await read("CANONICAL_ONLY");
    expect(Object.isFrozen(output.result)).toBe(true);
    expect(Object.isFrozen(output.result.entries)).toBe(true);
    expect(Object.isFrozen(output.result.entries[0])).toBe(true);
    expect(Object.isFrozen(output.configured.events[0])).toBe(true);
    expect(output.configured.events[0]).not.toHaveProperty("name");
    expect(output.configured.events[0]).not.toHaveProperty("studentId");
  });
});
