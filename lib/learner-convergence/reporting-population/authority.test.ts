import type {
  ClassRosterSource,
  ClassRosterStudentProjection,
} from "@/lib/learner-convergence/class-roster/domain";
import { ClassRosterSourceError } from "@/lib/learner-convergence/class-roster/errors";
import {
  readReportingPopulationByAuthority,
  resolveReportingPopulationAuthorityMode,
} from "@/lib/learner-convergence/reporting-population/authority";
import type {
  ReportingMetricCompatibilityResolver,
  ReportingPopulationAuthorityEvent,
} from "@/lib/learner-convergence/reporting-population/domain";

const entry: ClassRosterStudentProjection = Object.freeze({
  classId: "10000000-0000-4000-8000-000000000010",
  englishName: null,
  grade: "五年級",
  joinedAt: "2026-08-26T00:00:00.000Z",
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
  const loadCanonical = vi.fn(async () => [entry]);
  const loadLegacy = vi.fn(async () => [
    Object.freeze({ ...entry, name: null, studentId: null }),
  ]);
  const events: ReportingPopulationAuthorityEvent[] = [];
  const source: ClassRosterSource = { loadCanonical, loadLegacy };
  const compatibilityResolver: ReportingMetricCompatibilityResolver = {
    resolve: vi.fn(async () =>
      Object.freeze({
        canonicalLearnersWithoutLegacyMetrics: 1,
        identityUnresolvedCount: 1,
        references: Object.freeze([]),
      }),
    ),
  };
  return {
    compatibilityResolver,
    events,
    loadCanonical,
    loadLegacy,
    observer: {
      record: (event: ReportingPopulationAuthorityEvent) => events.push(event),
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
    result: await readReportingPopulationByAuthority({
      actorRole: "teacher",
      classCount: 1,
      compatibilityResolver: configured.compatibilityResolver,
      correlationId: "phase-5c-authority-test",
      mode,
      observer: configured.observer,
      organizationId: entry.organizationId,
      source: configured.source,
    }),
  };
}

describe("LE-001 Phase 5C Reporting population authority", () => {
  it("supports legacy, shadow, canonical-primary, and canonical-only independently", async () => {
    const legacy = await read("LEGACY_ONLY");
    expect(legacy.result.authority).toBe("LEGACY");
    expect(legacy.configured.loadCanonical).not.toHaveBeenCalled();

    const shadow = await read("LEGACY_PRIMARY_CANONICAL_SHADOW");
    expect(shadow.result.authority).toBe("LEGACY");
    expect(shadow.configured.loadCanonical).toHaveBeenCalledOnce();

    const primary = await read("CANONICAL_PRIMARY_LEGACY_FALLBACK");
    expect(primary.result.authority).toBe("CANONICAL");
    expect(primary.configured.loadLegacy).not.toHaveBeenCalled();

    const canonical = await read("CANONICAL_ONLY");
    expect(canonical.result.authority).toBe("CANONICAL");
    expect(canonical.configured.loadLegacy).not.toHaveBeenCalled();
  });

  it("falls back only for canonical runtime failure", async () => {
    const configured = setup();
    configured.loadCanonical.mockRejectedValue(
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

  it("does not fallback for empty population, integrity failure, or compatibility failure", async () => {
    const empty = setup();
    empty.loadCanonical.mockResolvedValue([]);
    await expect(
      read("CANONICAL_PRIMARY_LEGACY_FALLBACK", empty),
    ).resolves.toMatchObject({
      result: {
        authority: "CANONICAL",
        canonicalPopulationCount: 0,
        fallbackUsed: false,
      },
    });
    expect(empty.loadLegacy).not.toHaveBeenCalled();

    const integrity = setup();
    integrity.loadCanonical.mockRejectedValue(
      new ClassRosterSourceError("CANONICAL_INTEGRITY_FAILURE"),
    );
    await expect(
      read("CANONICAL_PRIMARY_LEGACY_FALLBACK", integrity),
    ).rejects.toMatchObject({ code: "CANONICAL_INTEGRITY_FAILURE" });
    expect(integrity.loadLegacy).not.toHaveBeenCalled();

    const compatibility = setup();
    vi.mocked(compatibility.compatibilityResolver.resolve).mockRejectedValue(
      new Error("mapping_integrity_failure"),
    );
    await expect(
      read("CANONICAL_PRIMARY_LEGACY_FALLBACK", compatibility),
    ).rejects.toThrow("mapping_integrity_failure");
    expect(compatibility.loadLegacy).not.toHaveBeenCalled();
  });

  it("rolls back without data writes and fails invalid overrides to legacy-only", async () => {
    expect(
      resolveReportingPopulationAuthorityMode({
        configuredMode: "UNKNOWN",
        selectedMode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
      }),
    ).toBe("LEGACY_ONLY");

    const rollback = await read("LEGACY_ONLY");
    expect(rollback.result.authority).toBe("LEGACY");
    expect(rollback.configured.loadCanonical).not.toHaveBeenCalled();
  });

  it("returns immutable results and aggregate-only observations", async () => {
    const output = await read("CANONICAL_ONLY");
    expect(Object.isFrozen(output.result)).toBe(true);
    expect(Object.isFrozen(output.result.entries)).toBe(true);
    expect(Object.isFrozen(output.configured.events[0])).toBe(true);
    expect(output.configured.events[0]).toMatchObject({
      canonicalLearnersWithoutLegacyMetrics: 1,
      compatibilityMappingCount: 0,
      identityUnresolvedCount: 1,
    });
    expect(output.configured.events[0]).not.toHaveProperty("studentId");
    expect(output.configured.events[0]).not.toHaveProperty("name");
  });
});
