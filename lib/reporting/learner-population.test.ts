import type { Database } from "@/lib/supabase/database.types";
import type { ClassRosterStudentProjection } from "@/lib/learner-convergence/class-roster/domain";
import { ClassRosterSourceError } from "@/lib/learner-convergence/class-roster/errors";
import { loadReportingLearnerPopulation } from "@/lib/reporting/learner-population";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];

const sourceMocks = vi.hoisted(() => ({
  loadCanonical: vi.fn(),
  loadLegacy: vi.fn(),
}));

vi.mock("@/lib/classroom/roster", () => ({
  createClassRosterSource: vi.fn(() => sourceMocks),
}));

const organizationId = "10000000-0000-4000-8000-000000000001";
const otherOrganizationId = "10000000-0000-4000-8000-000000000002";
const accountId = "20000000-0000-4000-8000-000000000001";
const otherTeacherId = "20000000-0000-4000-8000-000000000002";
const classId = "30000000-0000-4000-8000-000000000001";
const studentId = "40000000-0000-4000-8000-000000000001";
const membershipId = "50000000-0000-4000-8000-000000000001";

const classroom: ClassRow = {
  code: "P5C-MATH",
  created_at: "2026-08-26T00:00:00.000Z",
  description: null,
  grade: "五年級",
  id: classId,
  name: "Phase 5C 驗證班",
  organization_id: organizationId,
  school: null,
  school_year: 115,
  semester: 1,
  status: "active",
  subject: "數學",
  teacher_id: accountId,
  updated_at: "2026-08-26T00:00:00.000Z",
};

const canonicalEntry: ClassRosterStudentProjection = Object.freeze({
  classId,
  englishName: null,
  grade: "五年級",
  joinedAt: "2026-08-26T00:00:00.000Z",
  leftAt: null,
  membershipId,
  membershipStatus: "active",
  name: "無帳號受管理學生",
  organizationId,
  studentId,
  studentNo: "P5C-001",
  studentStatus: "active",
});

function input(
  overrides: Partial<Parameters<typeof loadReportingLearnerPopulation>[0]> = {},
): Parameters<typeof loadReportingLearnerPopulation>[0] {
  return {
    accountId,
    classroom,
    correlationId: "phase-5c-adapter-test",
    membershipStatus: "active",
    organizationId,
    role: "teacher",
    ...overrides,
  };
}

describe("LE-001 Phase 5C Reporting learner population adapter", () => {
  beforeEach(() => {
    sourceMocks.loadCanonical.mockResolvedValue([canonicalEntry]);
    sourceMocks.loadLegacy.mockResolvedValue([
      { ...canonicalEntry, name: null, studentId: null },
    ]);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it.each(["teacher", "organization_admin", "organization_owner"] as const)(
    "returns canonical current population for an authorized %s",
    async (role) => {
      const result = await loadReportingLearnerPopulation(input({ role }));

      expect(result).toMatchObject({
        authority: "CANONICAL",
        canonicalLearnersWithoutLegacyMetrics: 1,
        canonicalPopulationCount: 1,
        entries: [{ studentId }],
        identityUnresolvedCount: 1,
        metricCompatibilityReferences: [],
      });
    },
  );

  it("fails before any population read for inactive, unassigned, or cross-tenant scope", async () => {
    const denied = [
      input({ membershipStatus: "suspended" }),
      input({ accountId: otherTeacherId }),
      input({
        classroom: { ...classroom, organization_id: otherOrganizationId },
      }),
    ];

    for (const request of denied) {
      await expect(
        loadReportingLearnerPopulation(request),
      ).rejects.toMatchObject({ name: "ReportingError" });
    }
    expect(sourceMocks.loadCanonical).not.toHaveBeenCalled();
    expect(sourceMocks.loadLegacy).not.toHaveBeenCalled();
  });

  it("excludes archived Class current population while preserving Owner historical access", async () => {
    const result = await loadReportingLearnerPopulation(
      input({
        classroom: { ...classroom, status: "archived" },
        role: "organization_owner",
      }),
    );

    expect(result.entries).toEqual([]);
    expect(sourceMocks.loadCanonical).not.toHaveBeenCalled();
    expect(sourceMocks.loadLegacy).not.toHaveBeenCalled();

    await expect(
      loadReportingLearnerPopulation(
        input({ classroom: { ...classroom, status: "archived" } }),
      ),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("uses legacy only for rollback or a genuine canonical runtime failure", async () => {
    vi.stubEnv("LEARNER_REPORTING_POPULATION_AUTHORITY_MODE", "LEGACY_ONLY");
    const rollback = await loadReportingLearnerPopulation(input());
    expect(rollback.authority).toBe("LEGACY");
    expect(sourceMocks.loadCanonical).not.toHaveBeenCalled();

    vi.stubEnv(
      "LEARNER_REPORTING_POPULATION_AUTHORITY_MODE",
      "CANONICAL_PRIMARY_LEGACY_FALLBACK",
    );
    sourceMocks.loadCanonical.mockRejectedValue(
      new ClassRosterSourceError("CANONICAL_RUNTIME_FAILURE"),
    );
    const fallback = await loadReportingLearnerPopulation(input());
    expect(fallback).toMatchObject({ authority: "LEGACY", fallbackUsed: true });
  });

  it("logs only aggregate authority diagnostics", async () => {
    await loadReportingLearnerPopulation(input());
    const logs = JSON.stringify(vi.mocked(console.info).mock.calls);
    expect(logs).toContain("reporting-learner-authority");
    expect(logs).not.toContain("無帳號受管理學生");
    expect(logs).not.toContain(studentId);
    expect(logs).not.toContain(membershipId);
  });
});
