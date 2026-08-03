import { OrganizationError } from "@/lib/organization/errors";
import {
  getTeacherDashboard,
  getTeacherDashboardInsights,
} from "@/lib/teacher-dashboard/service";

const dependencyMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getClass: vi.fn(),
  getCurrentUser: vi.fn(),
  getStudentReport: vi.fn(),
  getTeacherReport: vi.fn(),
  listAssignments: vi.fn(),
  listStudentAssignments: vi.fn(),
  listTeacherClasses: vi.fn(),
  requireOrganizationRole: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: dependencyMocks.getCurrentUser,
}));

vi.mock("@/lib/organization/service", () => ({
  requireOrganizationRole: dependencyMocks.requireOrganizationRole,
}));

vi.mock("@/lib/classroom/service", () => ({
  getClass: dependencyMocks.getClass,
  listTeacherClasses: dependencyMocks.listTeacherClasses,
}));

vi.mock("@/lib/reporting/service", () => ({
  getStudentReport: dependencyMocks.getStudentReport,
  getTeacherReport: dependencyMocks.getTeacherReport,
}));

vi.mock("@/lib/assignment/service", () => ({
  listAssignments: dependencyMocks.listAssignments,
  listStudentAssignments: dependencyMocks.listStudentAssignments,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: dependencyMocks.createClient,
}));

const organizationId = "10000000-0000-4000-8000-000000000001";
const teacherId = "10000000-0000-4000-8000-000000000002";
const classId = "10000000-0000-4000-8000-000000000003";
const studentId = "10000000-0000-4000-8000-000000000004";

function installAccess() {
  dependencyMocks.getCurrentUser.mockResolvedValue({ id: teacherId });
  dependencyMocks.requireOrganizationRole.mockResolvedValue({
    membership: { role: "teacher" },
    organization: { id: organizationId },
  });
}

function installAuditMock() {
  const inserts: unknown[] = [];
  dependencyMocks.createClient.mockResolvedValue({
    from: (table: string) => ({
      insert: (row: unknown) => {
        inserts.push({ row, table });
        return Promise.resolve({ error: null });
      },
    }),
  });
  return inserts;
}

function installDashboardData() {
  dependencyMocks.listTeacherClasses.mockResolvedValue([
    {
      id: classId,
      name: "五年甲班",
      status: "active",
    },
  ]);
  dependencyMocks.getClass.mockResolvedValue({
    enrollments: [
      {
        status: "active",
        student_id: studentId,
      },
    ],
    id: classId,
    name: "五年甲班",
    status: "active",
  });
  dependencyMocks.getTeacherReport.mockResolvedValue({
    activityTrend: [{ accuracy: 0.7, date: "2026-07-30", questionCount: 10 }],
    assignmentCompletion: {
      assigned: 3,
      submissionRate: 0.667,
      submitted: 2,
    },
    classAccuracy: 0.7,
    classId,
    studentRanking: [],
    weakKnowledgeRanking: [
      {
        accuracy: 0.4,
        attemptCount: 5,
        knowledgePointId: "位值概念",
      },
    ],
  });
  dependencyMocks.getStudentReport.mockResolvedValue({
    learningTrend: [{ accuracy: 0.7, date: "2026-07-30", questionCount: 10 }],
    masterySummary: {
      beginner: 1,
      developing: 2,
      mastered: 0,
      proficient: 1,
      unknown: 0,
    },
    overallAccuracy: 0.7,
    recommendationCount: 1,
    recommendedDifficulty: [],
    studentId,
    weakKnowledge: [],
  });
  dependencyMocks.listAssignments.mockResolvedValue([{ id: "assignment-1" }]);
  dependencyMocks.listStudentAssignments.mockResolvedValue([
    {
      assignment_id: "assignment-1",
      status: "submitted",
    },
    {
      assignment_id: "assignment-1",
      status: "not_started",
    },
  ]);
}

describe("TD-001 teacher dashboard service", () => {
  afterEach(() => vi.clearAllMocks());

  it("builds dashboard through Reporting Service and writes dashboard audit", async () => {
    installAccess();
    installDashboardData();
    const inserts = installAuditMock();

    const dashboard = await getTeacherDashboard();

    expect(dependencyMocks.getTeacherReport).toHaveBeenCalledWith({ classId });
    expect(dependencyMocks.getStudentReport).toHaveBeenCalledWith({
      studentId,
    });
    expect(dashboard.todayOverview.averageAccuracy).toBe(0.7);
    expect(dashboard.weakKnowledge[0]).toEqual(
      expect.objectContaining({ knowledgePointId: "位值概念" }),
    );
    expect(inserts).toEqual([
      expect.objectContaining({
        row: expect.objectContaining({
          action: "TEACHER_DASHBOARD_VIEWED",
          actor_id: teacherId,
          organization_id: organizationId,
        }),
        table: "teacher_dashboard_audit_events",
      }),
    ]);
  });

  it("fails closed when student role requests teacher dashboard", async () => {
    dependencyMocks.requireOrganizationRole.mockRejectedValue(
      new OrganizationError("forbidden"),
    );
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getTeacherDashboard()).rejects.toMatchObject({
      code: "forbidden",
      name: "TeacherDashboardError",
      referenceId: expect.any(String),
    });
    expect(dependencyMocks.getTeacherReport).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      "[teacher-dashboard] operation failed",
      expect.stringContaining("resolve_trusted_account_context"),
    );
  });

  it("writes teaching insight audit separately", async () => {
    installAccess();
    installDashboardData();
    const inserts = installAuditMock();

    await getTeacherDashboardInsights();

    expect(
      inserts.some(
        (insert) =>
          (insert as { row: { action: string } }).row.action ===
          "TEACHING_INSIGHT_VIEWED",
      ),
    ).toBe(true);
  });

  it("returns a valid empty dashboard when teacher has no classes or analytics", async () => {
    installAccess();
    dependencyMocks.listTeacherClasses.mockResolvedValue([]);
    dependencyMocks.listAssignments.mockResolvedValue([]);
    dependencyMocks.listStudentAssignments.mockResolvedValue([]);
    installAuditMock();

    const dashboard = await getTeacherDashboard();

    expect(dashboard.classPerformance).toEqual([]);
    expect(dashboard.studentPerformance).toEqual([]);
    expect(dashboard.weakKnowledge).toEqual([]);
    expect(dashboard.recommendations).toEqual([]);
    expect(dashboard.assignmentStatus).toEqual({
      inProgress: 0,
      overdue: 0,
      pending: 0,
      submitted: 0,
    });
    expect(dashboard.todayOverview).toEqual({
      assignmentCompletionRate: 0,
      assignmentsDue: 0,
      averageAccuracy: 0,
      recentLearningActivity: 0,
      todaysActiveStudents: 0,
    });
    expect(dashboard.insights[0]).toEqual(
      expect.objectContaining({
        severity: "low",
        title: "學習狀態穩定",
      }),
    );
    expect(dependencyMocks.getTeacherReport).not.toHaveBeenCalled();
    expect(dependencyMocks.getStudentReport).not.toHaveBeenCalled();
  });

  it("logs but does not crash when dashboard view audit is unavailable", async () => {
    installAccess();
    installDashboardData();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    dependencyMocks.createClient.mockResolvedValue({
      from: () => ({
        insert: () =>
          Promise.resolve({
            error: {
              code: "42P01",
              message: 'relation "teacher_dashboard_audit_events" missing',
            },
          }),
      }),
    });

    const dashboard = await getTeacherDashboard();

    expect(dashboard.classPerformance).toHaveLength(1);
    expect(consoleSpy).toHaveBeenCalledWith(
      "[teacher-dashboard] operation failed",
      expect.stringContaining("write_teacher_dashboard_audit"),
    );
    expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain("token");
    expect(JSON.stringify(consoleSpy.mock.calls)).not.toContain("cookie");
  });

  it("maps assignment service failures to a safe teacher dashboard error", async () => {
    installAccess();
    dependencyMocks.listTeacherClasses.mockResolvedValue([]);
    dependencyMocks.listAssignments.mockRejectedValue(
      new Error("raw database connection failure"),
    );
    dependencyMocks.listStudentAssignments.mockResolvedValue([]);
    installAuditMock();
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(getTeacherDashboard()).rejects.toMatchObject({
      code: "service_unavailable",
      name: "TeacherDashboardError",
      referenceId: expect.any(String),
    });
    expect(consoleSpy).toHaveBeenCalledWith(
      "[teacher-dashboard] operation failed",
      expect.stringContaining("load_assignments"),
    );
  });
});
