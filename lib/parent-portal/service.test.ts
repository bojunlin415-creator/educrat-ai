import { OrganizationError } from "@/lib/organization/errors";
import { ParentPortalError } from "@/lib/parent-portal/errors";
import {
  getParentDashboard,
  getParentStudentReport,
  listParentChildren,
} from "@/lib/parent-portal/service";

const dependencyMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentUser: vi.fn(),
  getStudentReport: vi.fn(),
  requireOrganizationMembership: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: dependencyMocks.getCurrentUser,
}));

vi.mock("@/lib/organization/service", () => ({
  requireOrganizationMembership: dependencyMocks.requireOrganizationMembership,
}));

vi.mock("@/lib/reporting/service", () => ({
  getStudentReport: dependencyMocks.getStudentReport,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: dependencyMocks.createClient,
}));

const organizationId = "10000000-0000-4000-8000-000000000001";
const guardianId = "10000000-0000-4000-8000-000000000002";
const teacherId = "10000000-0000-4000-8000-000000000003";
const studentId = "10000000-0000-4000-8000-000000000004";
const otherStudentId = "10000000-0000-4000-8000-000000000005";

type Row = Readonly<Record<string, unknown>>;

function createQuery(rows: readonly Row[], inserts: Row[]) {
  let currentRows = [...rows];
  const query = {
    eq(column: string, value: unknown) {
      currentRows = currentRows.filter((row) => row[column] === value);
      return query;
    },
    in(column: string, values: readonly unknown[]) {
      currentRows = currentRows.filter((row) => values.includes(row[column]));
      return query;
    },
    insert(row: Row) {
      inserts.push(row);
      return Promise.resolve({ error: null });
    },
    limit(count: number) {
      currentRows = currentRows.slice(0, count);
      return query;
    },
    order() {
      return query;
    },
    select() {
      return query;
    },
    then(
      resolve: (value: {
        readonly data: readonly Row[];
        readonly error: null;
      }) => void,
    ) {
      resolve({ data: currentRows, error: null });
    },
  };
  return query;
}

function installData({
  membershipRole = "guardian",
  relationshipStatus = "active",
  relationshipOrganizationId = organizationId,
}: {
  readonly membershipRole?: string;
  readonly relationshipOrganizationId?: string;
  readonly relationshipStatus?: string;
} = {}) {
  const inserts: Row[] = [];
  dependencyMocks.getCurrentUser.mockResolvedValue({ id: guardianId });
  dependencyMocks.requireOrganizationMembership.mockResolvedValue({
    membership: { role: membershipRole, user_id: guardianId },
    organization: { id: organizationId },
  });
  dependencyMocks.getStudentReport.mockResolvedValue({
    learningTrend: [{ accuracy: 0.7, date: "2026-08-01", questionCount: 10 }],
    masterySummary: {
      beginner: 1,
      developing: 1,
      mastered: 0,
      proficient: 1,
      unknown: 0,
    },
    overallAccuracy: 0.7,
    recommendationCount: 1,
    recommendedDifficulty: [
      { difficulty: "medium", knowledgePointId: "分數加減" },
    ],
    studentId,
    weakKnowledge: [
      {
        knowledgePointId: "位值概念",
        masteryScore: 0.4,
        reason: "internal reason must not leak",
      },
    ],
  });
  const tableRows: Record<string, readonly Row[]> = {
    assignments: [
      {
        due_at: "2026-08-10T00:00:00Z",
        id: "assignment-1",
        organization_id: organizationId,
        title: "分數加減練習",
      },
    ],
    assignment_students: [
      {
        assigned_at: "2026-08-01T00:00:00Z",
        assignment_id: "assignment-1",
        organization_id: organizationId,
        status: "submitted",
        student_id: studentId,
      },
      {
        assigned_at: "2026-08-02T00:00:00Z",
        assignment_id: "assignment-2",
        organization_id: organizationId,
        status: "not_started",
        student_id: studentId,
      },
    ],
    parent_portal_audit_events: [],
    profiles: [
      {
        display_name: "小晴",
        id: studentId,
      },
    ],
    student_guardians: [
      {
        created_at: "2026-08-01T00:00:00Z",
        guardian_user_id: guardianId,
        id: "relationship-1",
        organization_id: relationshipOrganizationId,
        relationship_type: "parent",
        status: relationshipStatus,
        student_id: studentId,
        verified_at: "2026-08-01T00:00:00Z",
      },
    ],
  };
  dependencyMocks.createClient.mockResolvedValue({
    from: (table: string) => createQuery(tableRows[table] ?? [], inserts),
  });
  return inserts;
}

describe("PP-001 parent portal service", () => {
  afterEach(() => vi.clearAllMocks());

  it("allows a guardian to view a linked child and writes audit", async () => {
    const inserts = installData();

    const report = await getParentStudentReport(studentId);

    expect(report.child.displayName).toBe("小晴");
    expect(report.learningProgress.status).toBe("steady");
    expect(report.assignments.total).toBe(2);
    expect(JSON.stringify(report)).not.toContain("internal reason");
    expect(
      inserts.some(
        (insert) => insert.action === "PARENT_STUDENT_REPORT_VIEWED",
      ),
    ).toBe(true);
  });

  it("supports multiple-child selector through active relationships", async () => {
    installData();

    const children = await listParentChildren();

    expect(children).toHaveLength(1);
    expect(children[0]?.studentId).toBe(studentId);
  });

  it("denies an unlinked child", async () => {
    installData();

    await expect(getParentStudentReport(otherStudentId)).rejects.toEqual(
      new ParentPortalError("not_found"),
    );
  });

  it("denies revoked relationship", async () => {
    installData({ relationshipStatus: "revoked" });

    await expect(getParentStudentReport(studentId)).rejects.toEqual(
      new ParentPortalError("not_found"),
    );
    expect(dependencyMocks.getStudentReport).not.toHaveBeenCalled();
  });

  it.each(["pending", "verified"] as const)(
    "denies %s relationship before active consent",
    async (relationshipStatus) => {
      installData({ relationshipStatus });

      await expect(getParentStudentReport(studentId)).rejects.toEqual(
        new ParentPortalError("not_found"),
      );
      expect(dependencyMocks.getStudentReport).not.toHaveBeenCalled();
    },
  );

  it("denies cross-tenant relationship", async () => {
    installData({
      relationshipOrganizationId: "20000000-0000-4000-8000-000000000001",
    });

    await expect(getParentStudentReport(studentId)).rejects.toEqual(
      new ParentPortalError("not_found"),
    );
  });

  it("denies anonymous users", async () => {
    installData();
    dependencyMocks.getCurrentUser.mockResolvedValue(null);

    await expect(getParentDashboard()).rejects.toEqual(
      new ParentPortalError("not_authenticated"),
    );
  });

  it("does not treat teacher role as an implicit guardian", async () => {
    installData({ membershipRole: "teacher" });
    dependencyMocks.getCurrentUser.mockResolvedValue({ id: teacherId });

    await expect(getParentStudentReport(studentId)).rejects.toEqual(
      new ParentPortalError("forbidden"),
    );
  });

  it("denies student users querying another student", async () => {
    installData({ membershipRole: "student" });

    await expect(getParentStudentReport(otherStudentId)).rejects.toEqual(
      new ParentPortalError("forbidden"),
    );
  });

  it("maps organization errors to safe parent portal errors", async () => {
    dependencyMocks.requireOrganizationMembership.mockRejectedValue(
      new OrganizationError("not_member"),
    );

    await expect(getParentDashboard()).rejects.toEqual(
      new ParentPortalError("organization_required"),
    );
  });
});
