import {
  createClassRosterSource,
  getCanonicalClassRosterDetail,
} from "@/lib/classroom/roster";
import { ClassRosterSourceError } from "@/lib/learner-convergence/class-roster/errors";

type TableName =
  "classes" | "class_enrollments" | "student_class_members" | "students";

interface QueryResult {
  readonly data: unknown;
  readonly error: null | { readonly code: string };
}

const organizationId = "10000000-0000-4000-8000-000000000001";
const otherOrganizationId = "10000000-0000-4000-8000-000000000002";
const actorId = "20000000-0000-4000-8000-000000000001";
const otherTeacherId = "20000000-0000-4000-8000-000000000002";
const classId = "30000000-0000-4000-8000-000000000001";
const studentId = "40000000-0000-4000-8000-000000000001";
const membershipId = "50000000-0000-4000-8000-000000000001";

const classroom = {
  code: "P5A-MATH",
  created_at: "2026-08-19T00:00:00.000Z",
  description: null,
  grade: "五年級",
  id: classId,
  name: "Phase 5A 驗證班",
  organization_id: organizationId,
  school: null,
  school_year: 115,
  semester: 1,
  status: "active",
  subject: "數學",
  teacher_id: actorId,
  updated_at: "2026-08-19T00:00:00.000Z",
} as const;

const canonicalMembership = {
  class_id: classId,
  id: membershipId,
  joined_at: "2026-08-19T00:00:00.000Z",
  left_at: null,
  organization_id: organizationId,
  status: "active",
  student_id: studentId,
} as const;

const canonicalStudent = {
  english_name: null,
  grade: "五年級",
  id: studentId,
  name: "受管理學生",
  organization_id: organizationId,
  status: "active",
  student_no: "P5A-001",
} as const;

const state = vi.hoisted(() => ({
  calls: [] as Array<{
    readonly arguments: readonly unknown[];
    readonly operation: string;
    readonly table: string;
  }>,
  context: {
    membership: {
      role: "organization_owner",
      status: "active",
      user_id: "20000000-0000-4000-8000-000000000001",
    },
    organization: { id: "10000000-0000-4000-8000-000000000001" },
  },
  results: {} as Record<TableName, QueryResult>,
}));

vi.mock("@/lib/organization/service", () => ({
  requireOrganizationRole: vi.fn(async () => state.context),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from(table: TableName) {
      function record(operation: string, arguments_: readonly unknown[]) {
        state.calls.push({ arguments: arguments_, operation, table });
      }
      const query = {
        eq(...arguments_: readonly unknown[]) {
          record("eq", arguments_);
          return query;
        },
        in(...arguments_: readonly unknown[]) {
          record("in", arguments_);
          return query;
        },
        maybeSingle() {
          record("maybeSingle", []);
          return Promise.resolve(state.results[table]);
        },
        order(...arguments_: readonly unknown[]) {
          record("order", arguments_);
          return Promise.resolve(state.results[table]);
        },
        select(...arguments_: readonly unknown[]) {
          record("select", arguments_);
          return query;
        },
      };
      record("from", []);
      return query;
    },
  })),
}));

function resetState() {
  state.calls.length = 0;
  state.context = {
    membership: {
      role: "organization_owner",
      status: "active",
      user_id: actorId,
    },
    organization: { id: organizationId },
  };
  state.results = {
    class_enrollments: { data: [], error: null },
    classes: { data: classroom, error: null },
    student_class_members: { data: [canonicalMembership], error: null },
    students: { data: [canonicalStudent], error: null },
  };
}

describe("LE-001 Phase 5A canonical Class roster product read", () => {
  beforeEach(() => {
    resetState();
    vi.stubEnv(
      "LEARNER_CLASS_ROSTER_AUTHORITY_MODE",
      "CANONICAL_PRIMARY_LEGACY_FALLBACK",
    );
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each(["organization_owner", "organization_admin"] as const)(
    "returns the minimum managed/accountless projection for %s",
    async (role) => {
      state.context.membership.role = role;
      const result = await getCanonicalClassRosterDetail(classId);

      expect(result).toMatchObject({
        authority: "CANONICAL",
        class: {
          enrollments: [
            {
              english_name: null,
              grade: "五年級",
              membership_id: membershipId,
              membership_status: "active",
              name: "受管理學生",
              student_id: studentId,
              student_no: "P5A-001",
              student_status: "active",
            },
          ],
        },
        fallbackUsed: false,
      });
      expect(state.calls.filter((call) => call.operation === "from")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ table: "classes" }),
          expect.objectContaining({ table: "student_class_members" }),
          expect.objectContaining({ table: "students" }),
        ]),
      );
      expect(
        state.calls.some((call) =>
          ["profiles", "student_account_links", "users"].includes(call.table),
        ),
      ).toBe(false);
    },
  );

  it("allows only an assigned active Teacher and denies another Teacher before roster access", async () => {
    state.context.membership.role = "teacher";
    await expect(getCanonicalClassRosterDetail(classId)).resolves.toMatchObject(
      {
        authority: "CANONICAL",
      },
    );

    resetState();
    state.context.membership.role = "teacher";
    state.context.membership.user_id = otherTeacherId;
    await expect(getCanonicalClassRosterDetail(classId)).rejects.toMatchObject({
      code: "not_found",
    });
    expect(
      state.calls.filter((call) => call.table === "student_class_members"),
    ).toHaveLength(0);
  });

  it("denies an inactive Teacher and cross-tenant Class without exposing a roster", async () => {
    state.context.membership.role = "teacher";
    state.context.membership.status = "suspended";
    await expect(getCanonicalClassRosterDetail(classId)).rejects.toMatchObject({
      code: "forbidden",
    });

    resetState();
    state.results.classes = {
      data: { ...classroom, organization_id: otherOrganizationId },
      error: null,
    };
    await expect(getCanonicalClassRosterDetail(classId)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("preserves archived Class visibility for Owner/Admin but denies Teacher roster access", async () => {
    state.results.classes = {
      data: { ...classroom, status: "archived" },
      error: null,
    };
    await expect(getCanonicalClassRosterDetail(classId)).resolves.toMatchObject(
      {
        class: { status: "archived" },
      },
    );

    resetState();
    state.context.membership.role = "teacher";
    state.results.classes = {
      data: { ...classroom, status: "archived" },
      error: null,
    };
    await expect(getCanonicalClassRosterDetail(classId)).rejects.toMatchObject({
      code: "not_found",
    });
  });

  it("excludes left memberships and avoids a Student query for an empty active roster", async () => {
    state.results.student_class_members = { data: [], error: null };
    const result = await getCanonicalClassRosterDetail(classId);

    expect(result.class.enrollments).toEqual([]);
    expect(
      state.calls.some(
        (call) =>
          call.table === "student_class_members" &&
          call.operation === "eq" &&
          call.arguments[0] === "status" &&
          call.arguments[1] === "active",
      ),
    ).toBe(true);
    expect(
      state.calls.filter((call) => call.table === "students"),
    ).toHaveLength(0);
  });

  it("falls back only on a canonical runtime failure and keeps the reason non-sensitive", async () => {
    state.results.student_class_members = {
      data: null,
      error: { code: "08006" },
    };
    state.results.class_enrollments = {
      data: [canonicalMembership],
      error: null,
    };
    const result = await getCanonicalClassRosterDetail(classId);

    expect(result).toMatchObject({ authority: "LEGACY", fallbackUsed: true });
    expect(result.class.enrollments[0]).toMatchObject({ student_id: null });
    expect(console.info).toHaveBeenCalledWith(
      "[class-roster-authority]",
      expect.stringContaining('"fallbackReason":"canonical_read_failure"'),
    );
  });

  it("does not fallback on RLS denial or canonical integrity failure", async () => {
    state.results.student_class_members = {
      data: null,
      error: { code: "42501" },
    };
    await expect(getCanonicalClassRosterDetail(classId)).rejects.toMatchObject({
      code: "CANONICAL_INTEGRITY_FAILURE",
    });
    expect(
      state.calls.filter((call) => call.table === "class_enrollments"),
    ).toHaveLength(0);

    resetState();
    state.results.students = { data: [], error: null };
    await expect(getCanonicalClassRosterDetail(classId)).rejects.toMatchObject({
      code: "CANONICAL_INTEGRITY_FAILURE",
    });
    expect(
      state.calls.filter((call) => call.table === "class_enrollments"),
    ).toHaveLength(0);
  });

  it("loads multiple Students with one batched canonical Student query", async () => {
    const secondStudentId = "40000000-0000-4000-8000-000000000002";
    state.results.student_class_members = {
      data: [
        canonicalMembership,
        {
          ...canonicalMembership,
          id: "50000000-0000-4000-8000-000000000002",
          student_id: secondStudentId,
        },
      ],
      error: null,
    };
    state.results.students = {
      data: [
        canonicalStudent,
        {
          ...canonicalStudent,
          id: secondStudentId,
          name: "第二位學生",
          student_no: "P5A-002",
        },
      ],
      error: null,
    };

    const result = await getCanonicalClassRosterDetail(classId);
    expect(result.class.enrollments).toHaveLength(2);
    expect(
      state.calls.filter(
        (call) => call.table === "students" && call.operation === "in",
      ),
    ).toHaveLength(1);
  });

  it("loads multiple Classes with one membership query and one Student query", async () => {
    const secondClassId = "30000000-0000-4000-8000-000000000002";
    const secondStudentId = "40000000-0000-4000-8000-000000000002";
    state.results.student_class_members = {
      data: [
        canonicalMembership,
        {
          ...canonicalMembership,
          class_id: secondClassId,
          id: "50000000-0000-4000-8000-000000000002",
          student_id: secondStudentId,
        },
      ],
      error: null,
    };
    state.results.students = {
      data: [
        canonicalStudent,
        {
          ...canonicalStudent,
          id: secondStudentId,
          name: "第二班學生",
          student_no: "P5B-002",
        },
      ],
      error: null,
    };

    const source = createClassRosterSource({
      classIds: [classId, secondClassId],
      organizationId,
    });
    await expect(source.loadCanonical()).resolves.toHaveLength(2);
    expect(
      state.calls.filter(
        (call) =>
          call.table === "student_class_members" &&
          call.operation === "in" &&
          call.arguments[0] === "class_id",
      ),
    ).toEqual([
      expect.objectContaining({
        arguments: ["class_id", [classId, secondClassId]],
      }),
    ]);
    expect(
      state.calls.filter(
        (call) => call.table === "students" && call.operation === "in",
      ),
    ).toHaveLength(1);
  });

  it("supports canonical-only fail-closed behavior and a no-write legacy rollback", async () => {
    vi.stubEnv("LEARNER_CLASS_ROSTER_AUTHORITY_MODE", "CANONICAL_ONLY");
    state.results.student_class_members = {
      data: null,
      error: { code: "08006" },
    };
    await expect(getCanonicalClassRosterDetail(classId)).rejects.toBeInstanceOf(
      ClassRosterSourceError,
    );
    expect(
      state.calls.filter((call) => call.table === "class_enrollments"),
    ).toHaveLength(0);

    resetState();
    vi.stubEnv("LEARNER_CLASS_ROSTER_AUTHORITY_MODE", "LEGACY_ONLY");
    await expect(getCanonicalClassRosterDetail(classId)).resolves.toMatchObject(
      {
        authority: "LEGACY",
        fallbackUsed: false,
      },
    );
    expect(
      state.calls.filter((call) => call.table === "student_class_members"),
    ).toHaveLength(0);
    expect(
      state.calls.some((call) =>
        ["delete", "insert", "update", "upsert"].includes(call.operation),
      ),
    ).toBe(false);
  });
});
