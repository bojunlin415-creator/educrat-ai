import { ReportingError } from "@/lib/reporting/errors";
import {
  getOrganizationReport,
  getStudentReport,
  getTeacherReport,
} from "@/lib/reporting/service";

const dependencyMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentUser: vi.fn(),
  requireOrganizationMembership: vi.fn(),
  requireOrganizationRole: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: dependencyMocks.getCurrentUser,
}));

vi.mock("@/lib/organization/service", () => ({
  requireOrganizationMembership: dependencyMocks.requireOrganizationMembership,
  requireOrganizationRole: dependencyMocks.requireOrganizationRole,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: dependencyMocks.createClient,
}));

type InsertCapture = {
  readonly row: unknown;
  readonly table: string;
};

const organizationId = "10000000-0000-4000-8000-000000000001";
const studentId = "10000000-0000-4000-8000-000000000002";
const teacherId = "10000000-0000-4000-8000-000000000003";
const classId = "10000000-0000-4000-8000-000000000004";
const otherClassId = "10000000-0000-4000-8000-000000000005";

class FakeQuery {
  constructor(
    private readonly table: string,
    private readonly rowsByTable: Readonly<Record<string, readonly unknown[]>>,
    private readonly inserts: InsertCapture[],
  ) {}

  eq() {
    return this;
  }

  in() {
    return this;
  }

  insert(row: unknown) {
    this.inserts.push({ row, table: this.table });
    return Promise.resolve({ error: null });
  }

  limit() {
    return this;
  }

  maybeSingle() {
    return Promise.resolve({
      data: this.rows()[0] ?? null,
      error: null,
    });
  }

  order() {
    return this;
  }

  select() {
    return this;
  }

  then<TResult1 = { data: readonly unknown[]; error: null }, TResult2 = never>(
    onfulfilled?:
      | ((value: {
          data: readonly unknown[];
          error: null;
        }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve({ data: this.rows(), error: null }).then(
      onfulfilled,
      onrejected,
    );
  }

  private rows() {
    return this.rowsByTable[this.table] ?? [];
  }
}

function installSupabaseMock(
  rowsByTable: Readonly<Record<string, readonly unknown[]>>,
) {
  const inserts: InsertCapture[] = [];
  dependencyMocks.createClient.mockResolvedValue({
    from: (table: string) => new FakeQuery(table, rowsByTable, inserts),
  });
  return inserts;
}

function installMembership(role: string, userId: string) {
  dependencyMocks.getCurrentUser.mockResolvedValue({ id: userId });
  dependencyMocks.requireOrganizationMembership.mockResolvedValue({
    membership: { role },
    organization: { id: organizationId },
  });
}

describe("RP-001 reporting service", () => {
  afterEach(() => vi.clearAllMocks());

  it("allows a student to read only their own report and writes safe audit", async () => {
    installMembership("student", studentId);
    const inserts = installSupabaseMock({
      learning_events: [
        {
          answered_at: "2026-07-30T00:00:00.000Z",
          correct: true,
        },
        {
          answered_at: "2026-07-30T00:01:00.000Z",
          correct: false,
        },
      ],
      learning_recommendations: [
        {
          knowledge_point_id: "fraction-addition",
          recommended_difficulty: "easy",
        },
      ],
      student_knowledge_mastery: [
        {
          attempt_count: 4,
          knowledge_point_id: "fraction-addition",
          mastery_score: 0.42,
        },
      ],
      student_subject_summary: [
        {
          accuracy: 0.75,
          mastery_distribution: { beginner: 1, developing: 2 },
        },
      ],
    });

    const report = await getStudentReport({ studentId });

    expect(report.overallAccuracy).toBe(0.75);
    expect(report.studentId).toBe(studentId);
    expect(inserts).toEqual([
      expect.objectContaining({
        row: expect.objectContaining({
          action: "REPORT_VIEWED",
          actor_id: studentId,
          metadata: { report: "student", studentId },
          organization_id: organizationId,
        }),
        table: "report_audit_events",
      }),
    ]);
  });

  it("denies teacher access outside owned class scope before report audit", async () => {
    installMembership("teacher", teacherId);
    const inserts = installSupabaseMock({
      classes: [{ id: otherClassId }],
    });

    await expect(getTeacherReport({ classId })).rejects.toEqual(
      new ReportingError("forbidden"),
    );
    expect(inserts).toHaveLength(0);
  });

  it("allows organization admin report access through organization gate", async () => {
    dependencyMocks.getCurrentUser.mockResolvedValue({ id: teacherId });
    dependencyMocks.requireOrganizationRole.mockResolvedValue({
      membership: { role: "organization_admin" },
      organization: { id: organizationId },
    });
    const inserts = installSupabaseMock({
      teacher_class_summary: [
        {
          accuracy: 0.8,
          activity_trend: [
            {
              accuracy: 0.8,
              date: "2026-07-30",
              questionCount: 10,
            },
          ],
          class_id: classId,
          knowledge_distribution: { beginner: 1 },
          teacher_id: teacherId,
        },
      ],
    });

    const report = await getOrganizationReport();

    expect(report.organizationAccuracy).toBe(0.8);
    expect(report.classComparison).toEqual([{ accuracy: 0.8, classId }]);
    expect(inserts).toEqual([
      expect.objectContaining({
        row: expect.objectContaining({
          action: "REPORT_VIEWED",
          actor_id: teacherId,
          metadata: { report: "organization" },
          organization_id: organizationId,
        }),
        table: "report_audit_events",
      }),
    ]);
  });
});
