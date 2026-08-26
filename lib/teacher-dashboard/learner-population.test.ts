import type { Database } from "@/lib/supabase/database.types";
import type { ClassRosterStudentProjection } from "@/lib/learner-convergence/class-roster/domain";
import { ClassRosterSourceError } from "@/lib/learner-convergence/class-roster/errors";
import { loadTeacherDashboardLearnerPopulation } from "@/lib/teacher-dashboard/learner-population";

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
  code: "P5B-MATH",
  created_at: "2026-08-20T00:00:00.000Z",
  description: null,
  grade: "五年級",
  id: classId,
  name: "Phase 5B 驗證班",
  organization_id: organizationId,
  school: null,
  school_year: 115,
  semester: 1,
  status: "active",
  subject: "數學",
  teacher_id: accountId,
  updated_at: "2026-08-20T00:00:00.000Z",
};

const canonicalEntry: ClassRosterStudentProjection = {
  classId,
  englishName: null,
  grade: "五年級",
  joinedAt: "2026-08-20T00:00:00.000Z",
  leftAt: null,
  membershipId,
  membershipStatus: "active",
  name: "無帳號受管理學生",
  organizationId,
  studentId,
  studentNo: "S-001",
  studentStatus: "active",
};

function input(
  overrides: Partial<
    Parameters<typeof loadTeacherDashboardLearnerPopulation>[0]
  > = {},
): Parameters<typeof loadTeacherDashboardLearnerPopulation>[0] {
  return {
    accountId,
    classes: [classroom],
    correlationId: "phase-5b-adapter-test",
    membershipStatus: "active",
    organizationId,
    role: "teacher",
    ...overrides,
  };
}

describe("LE-001 Phase 5B Teacher Dashboard learner population adapter", () => {
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
    "returns canonical managed/accountless learners for an authorized %s",
    async (role) => {
      const result = await loadTeacherDashboardLearnerPopulation(
        input({ role }),
      );

      expect(result).toMatchObject({
        entries: [
          {
            classId,
            displayName: "無帳號受管理學生",
            membershipId,
            membershipStatus: "active",
            studentId,
            studentStatus: "active",
          },
        ],
        learnerCount: 1,
      });
      expect(result.classLearnerCounts.get(classId)).toBe(1);
    },
  );

  it("fails before any roster read for inactive, unassigned, archived, or cross-tenant Teacher scope", async () => {
    const denied = [
      input({ membershipStatus: "suspended" }),
      input({ accountId: otherTeacherId }),
      input({ classes: [{ ...classroom, status: "archived" }] }),
      input({
        classes: [{ ...classroom, organization_id: otherOrganizationId }],
      }),
    ];

    for (const request of denied) {
      await expect(
        loadTeacherDashboardLearnerPopulation(request),
      ).rejects.toMatchObject({
        name: "ClassroomError",
      });
    }
    expect(sourceMocks.loadCanonical).not.toHaveBeenCalled();
    expect(sourceMocks.loadLegacy).not.toHaveBeenCalled();
  });

  it("masks legacy Profile identity when canonical runtime fallback is used", async () => {
    sourceMocks.loadCanonical.mockRejectedValue(
      new ClassRosterSourceError("CANONICAL_RUNTIME_FAILURE"),
    );
    const result = await loadTeacherDashboardLearnerPopulation(input());

    expect(result.entries).toEqual([
      {
        classId,
        displayName: null,
        membershipId,
        membershipStatus: "active",
        studentId: null,
        studentStatus: null,
      },
    ]);
    expect(console.info).toHaveBeenCalledWith(
      "[teacher-dashboard-learner-authority]",
      expect.stringContaining('"fallbackUsed":true'),
    );
  });

  it("supports no-write rollback without exposing names or identifiers in logs", async () => {
    vi.stubEnv(
      "LEARNER_TEACHER_DASHBOARD_POPULATION_AUTHORITY_MODE",
      "LEGACY_ONLY",
    );
    await loadTeacherDashboardLearnerPopulation(input());

    expect(sourceMocks.loadCanonical).not.toHaveBeenCalled();
    expect(sourceMocks.loadLegacy).toHaveBeenCalledOnce();
    const logs = JSON.stringify(vi.mocked(console.info).mock.calls);
    expect(logs).not.toContain("無帳號受管理學生");
    expect(logs).not.toContain(studentId);
    expect(logs).not.toContain(membershipId);
  });
});
