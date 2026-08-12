import { OrganizationError } from "@/lib/organization/errors";
import { getStudentErrorStatus, StudentError } from "@/lib/student/errors";
import {
  archiveStudent,
  assignStudentToClass,
  createStudent,
  getStudent,
  listAllStudents,
  removeStudentFromClass,
  restoreStudent,
  updateStudent,
} from "@/lib/student/service";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentUser: vi.fn(),
  requireOrganizationRole: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({ getCurrentUser: mocks.getCurrentUser }));
vi.mock("@/lib/organization/service", () => ({
  requireOrganizationRole: mocks.requireOrganizationRole,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

const actorId = "10000000-0000-4000-8000-000000000001";
const organizationId = "10000000-0000-4000-8000-000000000002";
const studentId = "10000000-0000-4000-8000-000000000003";
const classId = "10000000-0000-4000-8000-000000000004";
const membershipId = "10000000-0000-4000-8000-000000000005";
const otherTeacherId = "10000000-0000-4000-8000-000000000006";
const student = {
  birthday: null,
  created_at: "2026-08-06",
  english_name: null,
  gender: "undisclosed",
  grade: "五年級",
  id: studentId,
  name: "測試學生",
  organization_id: organizationId,
  school: null,
  status: "active",
  student_no: "S001",
  updated_at: "2026-08-06",
} as const;

const classroom = {
  id: classId,
  organization_id: organizationId,
  status: "active",
  teacher_id: actorId,
} as const;

const membership = {
  class_id: classId,
  created_at: "2026-08-06",
  id: membershipId,
  joined_at: "2026-08-06",
  left_at: null,
  organization_id: organizationId,
  status: "active",
  student_id: studentId,
  updated_at: "2026-08-06",
} as const;

type DatabaseError = { code?: string; message?: string } | null;

async function expectStudentServiceError(
  promise: Promise<unknown>,
  code: StudentError["code"],
  status: number,
) {
  try {
    await promise;
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(StudentError);
    const studentError = error as StudentError;
    expect(studentError.code).toBe(code);
    expect(getStudentErrorStatus(studentError)).toBe(status);
    return;
  }
  throw new Error(`Expected StudentError(${code})`);
}

function makeStudentLookupClient(data: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const eqOrganization = vi.fn().mockReturnValue({ maybeSingle });
  const eqId = vi.fn().mockReturnValue({ eq: eqOrganization });
  const select = vi.fn().mockReturnValue({ eq: eqId });
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from }, eqOrganization, maybeSingle };
}

function makeStudentUpdateClient(data: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const select = vi.fn().mockReturnValue({ maybeSingle });
  const eqStatus = vi.fn().mockReturnValue({ select });
  const eqOrganization = vi.fn().mockReturnValue({ eq: eqStatus });
  const eqId = vi.fn().mockReturnValue({ eq: eqOrganization });
  const update = vi.fn().mockReturnValue({ eq: eqId });
  const from = vi.fn().mockReturnValue({ update });
  return { client: { from }, eqOrganization, eqStatus, update };
}

function makeStudentListClient(data: unknown[], count: number) {
  const range = vi.fn().mockResolvedValue({ count, data, error: null });
  const query = {
    eq: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    range,
  };
  query.eq.mockReturnValue(query);
  query.or.mockReturnValue(query);
  query.order.mockReturnValue(query);
  const select = vi.fn().mockReturnValue(query);
  const from = vi.fn().mockReturnValue({ select });
  return { client: { from }, order: query.order, range };
}

type MembershipClientOptions = {
  classroom?: unknown;
  existing?: unknown;
  insertData?: unknown;
  insertError?: DatabaseError;
  reactivationData?: unknown;
  reactivationError?: DatabaseError;
  studentRow?: unknown;
};

function makeMembershipClient({
  classroom: classroomRow = classroom,
  existing = null,
  insertData = membership,
  insertError = null,
  reactivationData = membership,
  reactivationError = null,
  studentRow = student,
}: MembershipClientOptions = {}) {
  const classMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: classroomRow, error: null });
  const classEqOrganization = vi
    .fn()
    .mockReturnValue({ maybeSingle: classMaybeSingle });
  const classEqId = vi.fn().mockReturnValue({ eq: classEqOrganization });
  const classSelect = vi.fn().mockReturnValue({ eq: classEqId });

  const studentMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: studentRow, error: null });
  const studentEqOrganization = vi
    .fn()
    .mockReturnValue({ maybeSingle: studentMaybeSingle });
  const studentEqId = vi.fn().mockReturnValue({ eq: studentEqOrganization });
  const studentSelect = vi.fn().mockReturnValue({ eq: studentEqId });

  const existingMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: existing, error: null });
  const existingEqOrganization = vi
    .fn()
    .mockReturnValue({ maybeSingle: existingMaybeSingle });
  const existingEqStudent = vi
    .fn()
    .mockReturnValue({ eq: existingEqOrganization });
  const existingEqClass = vi.fn().mockReturnValue({ eq: existingEqStudent });
  const existingSelect = vi.fn().mockReturnValue({ eq: existingEqClass });

  const reactivationMaybeSingle = vi.fn().mockResolvedValue({
    data: reactivationData,
    error: reactivationError,
  });
  const reactivationSelect = vi
    .fn()
    .mockReturnValue({ maybeSingle: reactivationMaybeSingle });
  const reactivationEqStatus = vi
    .fn()
    .mockReturnValue({ select: reactivationSelect });
  const reactivationEqOrganization = vi
    .fn()
    .mockReturnValue({ eq: reactivationEqStatus });
  const reactivationEqId = vi
    .fn()
    .mockReturnValue({ eq: reactivationEqOrganization });
  const updateMembership = vi.fn().mockReturnValue({ eq: reactivationEqId });

  const insertSingle = vi
    .fn()
    .mockResolvedValue({ data: insertData, error: insertError });
  const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
  const insertMembership = vi.fn().mockReturnValue({ select: insertSelect });

  const membershipTable = {
    insert: insertMembership,
    select: existingSelect,
    update: updateMembership,
  };
  const from = vi.fn((table: string) => {
    if (table === "classes") return { select: classSelect };
    if (table === "students") return { select: studentSelect };
    if (table === "student_class_members") return membershipTable;
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    classEqOrganization,
    client: { from },
    existingEqOrganization,
    insertMembership,
    reactivationEqOrganization,
    reactivationEqStatus,
    updateMembership,
  };
}

type RemoveClientOptions = {
  classroom?: unknown;
  membershipData?: unknown;
  membershipError?: DatabaseError;
};

function makeRemoveClient({
  classroom: classroomRow = classroom,
  membershipData = membership,
  membershipError = null,
}: RemoveClientOptions = {}) {
  const classMaybeSingle = vi
    .fn()
    .mockResolvedValue({ data: classroomRow, error: null });
  const classEqOrganization = vi
    .fn()
    .mockReturnValue({ maybeSingle: classMaybeSingle });
  const classEqId = vi.fn().mockReturnValue({ eq: classEqOrganization });
  const classSelect = vi.fn().mockReturnValue({ eq: classEqId });

  const membershipMaybeSingle = vi.fn().mockResolvedValue({
    data: membershipData,
    error: membershipError,
  });
  const membershipSelect = vi
    .fn()
    .mockReturnValue({ maybeSingle: membershipMaybeSingle });
  const membershipEqStatus = vi
    .fn()
    .mockReturnValue({ select: membershipSelect });
  const membershipEqOrganization = vi
    .fn()
    .mockReturnValue({ eq: membershipEqStatus });
  const membershipEqStudent = vi
    .fn()
    .mockReturnValue({ eq: membershipEqOrganization });
  const membershipEqClass = vi
    .fn()
    .mockReturnValue({ eq: membershipEqStudent });
  const updateMembership = vi.fn().mockReturnValue({ eq: membershipEqClass });

  const from = vi.fn((table: string) => {
    if (table === "classes") return { select: classSelect };
    if (table === "student_class_members") {
      return { update: updateMembership };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    classEqOrganization,
    client: { from },
    membershipEqOrganization,
    membershipEqStatus,
    updateMembership,
  };
}

describe("Sprint 8 student service", () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockResolvedValue({ id: actorId });
    mocks.requireOrganizationRole.mockResolvedValue({
      membership: { role: "organization_admin" },
      organization: { id: organizationId },
    });
  });
  afterEach(() => vi.resetAllMocks());

  it.each(["organization_owner", "organization_admin", "teacher"])(
    "allows %s through the canonical manager boundary",
    async (role) => {
      mocks.requireOrganizationRole.mockResolvedValue({
        membership: { role },
        organization: { id: organizationId },
      });
      const single = vi.fn().mockResolvedValue({ data: student, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const insertStudent = vi.fn().mockReturnValue({ select });
      mocks.createClient.mockResolvedValue({
        from: vi.fn().mockReturnValue({ insert: insertStudent }),
      });

      await expect(
        createStudent({
          gender: "undisclosed",
          grade: "五年級",
          name: "測試學生",
          studentNo: "S001",
        }),
      ).resolves.toEqual(student);
      expect(insertStudent).toHaveBeenCalledWith(
        expect.objectContaining({ organization_id: organizationId }),
      );
      expect(insertStudent.mock.calls[0]?.[0]).not.toHaveProperty("id");
      expect(insertStudent.mock.calls[0]?.[0]).not.toHaveProperty("status");
    },
  );

  it("rejects ordinary members", async () => {
    mocks.requireOrganizationRole.mockRejectedValue(
      new OrganizationError("forbidden"),
    );
    await expect(
      createStudent({
        gender: "undisclosed",
        grade: "五年級",
        name: "測試學生",
        studentNo: "S001",
      }),
    ).rejects.toEqual(new StudentError("forbidden"));
  });

  it("returns not found when a student is outside the active organization", async () => {
    mocks.requireOrganizationRole.mockResolvedValue({
      membership: { role: "teacher" },
      organization: { id: organizationId },
    });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqOrganization = vi.fn().mockReturnValue({ maybeSingle });
    const eqId = vi.fn().mockReturnValue({ eq: eqOrganization });
    mocks.createClient.mockResolvedValue({
      from: vi
        .fn()
        .mockReturnValue({ select: vi.fn().mockReturnValue({ eq: eqId }) }),
    });
    await expect(getStudent(studentId)).rejects.toEqual(
      new StudentError("not_found"),
    );
    expect(eqOrganization).toHaveBeenCalledWith(
      "organization_id",
      organizationId,
    );
  });

  it("loads every student across 100-row service pages", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => ({
      ...student,
      id: `student-${index + 1}`,
    }));
    const finalStudent = { ...student, id: "student-101" };
    const pageOne = makeStudentListClient(firstPage, 101);
    const pageTwo = makeStudentListClient([finalStudent], 101);
    mocks.createClient
      .mockResolvedValueOnce(pageOne.client)
      .mockResolvedValueOnce(pageTwo.client);

    const result = await listAllStudents({ status: "all" });

    expect(result).toHaveLength(101);
    expect(result.at(-1)).toEqual(finalStudent);
    expect(pageOne.range).toHaveBeenCalledWith(0, 99);
    expect(pageTwo.range).toHaveBeenCalledWith(100, 199);
    for (const page of [pageOne, pageTwo]) {
      expect(page.order).toHaveBeenNthCalledWith(1, "created_at", {
        ascending: false,
      });
      expect(page.order).toHaveBeenNthCalledWith(2, "id", {
        ascending: false,
      });
    }
  });

  describe("student lifecycle guards", () => {
    it("returns 409 before PATCHing an archived student", async () => {
      const lookup = makeStudentLookupClient({
        ...student,
        status: "archived",
      });
      mocks.createClient.mockResolvedValue(lookup.client);

      await expectStudentServiceError(
        updateStudent(studentId, { name: "封存學生新名稱" }),
        "invalid_student_state",
        409,
      );
      expect(mocks.createClient).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["archive", "archived", archiveStudent],
      ["restore", "active", restoreStudent],
    ] as const)(
      "returns 409 when a repeated %s sees an already-%s student",
      async (_action, currentStatus, operation) => {
        const lookup = makeStudentLookupClient({
          ...student,
          status: currentStatus,
        });
        mocks.createClient.mockResolvedValue(lookup.client);

        await expectStudentServiceError(
          operation(studentId),
          "invalid_student_state",
          409,
        );
        expect(mocks.createClient).toHaveBeenCalledTimes(1);
      },
    );

    it("returns 409 when an active-only PATCH loses a concurrent status race", async () => {
      const lookup = makeStudentLookupClient(student);
      const update = makeStudentUpdateClient(null);
      mocks.createClient
        .mockResolvedValueOnce(lookup.client)
        .mockResolvedValueOnce(update.client);

      await expectStudentServiceError(
        updateStudent(studentId, { name: "並行更新" }),
        "invalid_student_state",
        409,
      );
      expect(update.eqStatus).toHaveBeenCalledWith("status", "active");
      expect(update.eqOrganization).toHaveBeenCalledWith(
        "organization_id",
        organizationId,
      );
    });

    it.each([
      ["archive", "active", archiveStudent],
      ["restore", "archived", restoreStudent],
    ] as const)(
      "returns 409 when a conditional %s status update affects zero rows",
      async (_action, currentStatus, operation) => {
        const lookup = makeStudentLookupClient({
          ...student,
          status: currentStatus,
        });
        const update = makeStudentUpdateClient(null);
        mocks.createClient
          .mockResolvedValueOnce(lookup.client)
          .mockResolvedValueOnce(update.client);

        await expectStudentServiceError(
          operation(studentId),
          "invalid_student_state",
          409,
        );
        expect(update.eqStatus).toHaveBeenCalledWith("status", currentStatus);
      },
    );
  });

  describe("class membership assignment", () => {
    it("returns 409 for an already-active membership without mutating it", async () => {
      const client = makeMembershipClient({
        existing: { id: membershipId, status: "active" },
      });
      mocks.createClient.mockResolvedValue(client.client);

      await expectStudentServiceError(
        assignStudentToClass(classId, studentId),
        "membership_conflict",
        409,
      );
      expect(client.updateMembership).not.toHaveBeenCalled();
      expect(client.insertMembership).not.toHaveBeenCalled();
    });

    it("reactivates a left membership only while its old status is still left", async () => {
      const client = makeMembershipClient({
        existing: { id: membershipId, status: "left" },
      });
      mocks.createClient.mockResolvedValue(client.client);

      await expect(assignStudentToClass(classId, studentId)).resolves.toEqual(
        membership,
      );
      expect(client.updateMembership).toHaveBeenCalledWith(
        expect.objectContaining({ left_at: null, status: "active" }),
      );
      expect(client.reactivationEqStatus).toHaveBeenCalledWith(
        "status",
        "left",
      );
      expect(client.reactivationEqOrganization).toHaveBeenCalledWith(
        "organization_id",
        organizationId,
      );
    });

    it("returns 409 when a left-membership reactivation loses its status race", async () => {
      const client = makeMembershipClient({
        existing: { id: membershipId, status: "left" },
        reactivationData: null,
      });
      mocks.createClient.mockResolvedValue(client.client);

      await expectStudentServiceError(
        assignStudentToClass(classId, studentId),
        "membership_conflict",
        409,
      );
      expect(client.reactivationEqStatus).toHaveBeenCalledWith(
        "status",
        "left",
      );
    });

    it("maps an insert uniqueness race to membership_conflict instead of student_no", async () => {
      const client = makeMembershipClient({
        existing: null,
        insertData: null,
        insertError: { code: "23505", message: "duplicate membership" },
      });
      mocks.createClient.mockResolvedValue(client.client);

      await expectStudentServiceError(
        assignStudentToClass(classId, studentId),
        "membership_conflict",
        409,
      );
      expect(client.insertMembership).toHaveBeenCalledWith(
        expect.objectContaining({
          class_id: classId,
          organization_id: organizationId,
          student_id: studentId,
        }),
      );
    });
  });

  describe("class membership removal", () => {
    it("returns 404 when the class is outside the active organization", async () => {
      const client = makeRemoveClient({ classroom: null });
      mocks.createClient.mockResolvedValue(client.client);

      await expectStudentServiceError(
        removeStudentFromClass(classId, studentId),
        "not_found",
        404,
      );
      expect(client.classEqOrganization).toHaveBeenCalledWith(
        "organization_id",
        organizationId,
      );
      expect(client.updateMembership).not.toHaveBeenCalled();
    });

    it("returns 404 when no active tenant-scoped membership can be removed", async () => {
      const client = makeRemoveClient({ membershipData: null });
      mocks.createClient.mockResolvedValue(client.client);

      await expectStudentServiceError(
        removeStudentFromClass(classId, studentId),
        "not_found",
        404,
      );
      expect(client.membershipEqOrganization).toHaveBeenCalledWith(
        "organization_id",
        organizationId,
      );
      expect(client.membershipEqStatus).toHaveBeenCalledWith(
        "status",
        "active",
      );
    });

    it("returns 403 when a teacher tries to remove from another teacher's class", async () => {
      mocks.requireOrganizationRole.mockResolvedValue({
        membership: { role: "teacher" },
        organization: { id: organizationId },
      });
      const client = makeRemoveClient({
        classroom: { teacher_id: otherTeacherId },
      });
      mocks.createClient.mockResolvedValue(client.client);

      await expectStudentServiceError(
        removeStudentFromClass(classId, studentId),
        "forbidden",
        403,
      );
      expect(client.updateMembership).not.toHaveBeenCalled();
    });
  });
});
