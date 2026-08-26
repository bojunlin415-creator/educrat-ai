import {
  prepareAssignmentClassExpansion,
  requireMaterializableAssignmentRecipients,
} from "@/lib/assignment/class-expansion";
import { ClassRosterSourceError } from "@/lib/learner-convergence/class-roster/errors";

const organizationId = "10000000-0000-4000-8000-000000000001";
const otherOrganizationId = "10000000-0000-4000-8000-000000000002";
const actorId = "20000000-0000-4000-8000-000000000001";
const otherTeacherId = "20000000-0000-4000-8000-000000000002";
const classId = "30000000-0000-4000-8000-000000000001";
const secondClassId = "30000000-0000-4000-8000-000000000002";
const studentId = "40000000-0000-4000-8000-000000000001";

const state = vi.hoisted(() => ({
  calls: [] as Array<{
    readonly arguments: readonly unknown[];
    readonly operation: string;
    readonly table: string;
  }>,
  canonicalEntries: [
    {
      classId: "30000000-0000-4000-8000-000000000001",
      englishName: null,
      grade: null,
      joinedAt: "2026-08-20T00:00:00.000Z",
      leftAt: null,
      membershipId: "50000000-0000-4000-8000-000000000001",
      membershipStatus: "active",
      name: null,
      organizationId: "10000000-0000-4000-8000-000000000001",
      studentId: "40000000-0000-4000-8000-000000000001",
      studentNo: null,
      studentStatus: "active",
    },
  ] as readonly Record<string, unknown>[],
  canonicalError: null as Error | null,
  classes: [
    {
      id: "30000000-0000-4000-8000-000000000001",
      organization_id: "10000000-0000-4000-8000-000000000001",
      status: "active",
      teacher_id: "20000000-0000-4000-8000-000000000001",
    },
  ] as readonly Record<string, unknown>[],
  legacyEnrollments: [] as readonly Record<string, unknown>[],
}));

vi.mock("@/lib/classroom/roster", () => ({
  createClassRosterSource: vi.fn(() => ({
    loadCanonical: vi.fn(async () => {
      if (state.canonicalError) throw state.canonicalError;
      return state.canonicalEntries;
    }),
    loadLegacy: vi.fn(async () => []),
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from(table: string) {
      const result =
        table === "classes"
          ? { data: state.classes, error: null }
          : { data: state.legacyEnrollments, error: null };
      const query = {
        eq(...arguments_: readonly unknown[]) {
          state.calls.push({ arguments: arguments_, operation: "eq", table });
          return query;
        },
        in(...arguments_: readonly unknown[]) {
          state.calls.push({ arguments: arguments_, operation: "in", table });
          return query;
        },
        order(...arguments_: readonly unknown[]) {
          state.calls.push({
            arguments: arguments_,
            operation: "order",
            table,
          });
          return Promise.resolve(result);
        },
        select(...arguments_: readonly unknown[]) {
          state.calls.push({
            arguments: arguments_,
            operation: "select",
            table,
          });
          return query;
        },
        then(resolve: (value: typeof result) => unknown) {
          return Promise.resolve(result).then(resolve);
        },
      };
      state.calls.push({ arguments: [], operation: "from", table });
      return query;
    },
  })),
}));

function resetState() {
  state.calls.length = 0;
  state.canonicalError = null;
  state.classes = [
    {
      id: classId,
      organization_id: organizationId,
      status: "active",
      teacher_id: actorId,
    },
  ];
  state.canonicalEntries = [
    {
      classId,
      englishName: null,
      grade: null,
      joinedAt: "2026-08-20T00:00:00.000Z",
      leftAt: null,
      membershipId: "50000000-0000-4000-8000-000000000001",
      membershipStatus: "active",
      name: null,
      organizationId,
      studentId,
      studentNo: null,
      studentStatus: "active",
    },
  ];
  state.legacyEnrollments = [];
}

describe("LE-001 Phase 5D Assignment product adapter", () => {
  beforeEach(() => {
    resetState();
    vi.stubEnv(
      "LEARNER_ASSIGNMENT_CLASS_EXPANSION_AUTHORITY_MODE",
      "CANONICAL_PRIMARY_LEGACY_FALLBACK",
    );
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it.each(["organization_owner", "organization_admin"] as const)(
    "allows %s to expand a scoped active Class",
    async (actorRole) => {
      const plan = await prepareAssignmentClassExpansion({
        actorId,
        actorRole,
        assignmentId: null,
        classIds: [classId],
        organizationId,
      });

      expect(plan.result).toMatchObject({
        authority: "CANONICAL",
        canonicalCandidateCount: 1,
        fallbackUsed: false,
        identityUnresolvedCount: 1,
      });
      expect(() => requireMaterializableAssignmentRecipients(plan)).toThrow(
        expect.objectContaining({ code: "recipient_identity_unavailable" }),
      );
    },
  );

  it("treats a zero-member Class as an authoritative empty expansion", async () => {
    state.canonicalEntries = [];
    const plan = await prepareAssignmentClassExpansion({
      actorId,
      actorRole: "organization_owner",
      assignmentId: null,
      classIds: [classId],
      organizationId,
    });

    expect(plan.result).toMatchObject({
      authority: "CANONICAL",
      canonicalCandidateCount: 0,
      identityUnresolvedCount: 0,
    });
    expect(() => requireMaterializableAssignmentRecipients(plan)).not.toThrow();
  });

  it("retains every canonical learner candidate before materialization", async () => {
    state.canonicalEntries = [
      state.canonicalEntries[0]!,
      {
        ...state.canonicalEntries[0],
        membershipId: "50000000-0000-4000-8000-000000000002",
        studentId: "40000000-0000-4000-8000-000000000002",
      },
    ];
    const plan = await prepareAssignmentClassExpansion({
      actorId,
      actorRole: "organization_admin",
      assignmentId: null,
      classIds: [classId],
      organizationId,
    });

    expect(plan.result).toMatchObject({
      canonicalCandidateCount: 2,
      identityUnresolvedCount: 2,
    });
    expect(plan.result.candidates).toHaveLength(2);
  });

  it("allows the assigned Teacher and rejects an unassigned Teacher before learner reads", async () => {
    await expect(
      prepareAssignmentClassExpansion({
        actorId,
        actorRole: "teacher",
        assignmentId: null,
        classIds: [classId],
        organizationId,
      }),
    ).resolves.toMatchObject({ result: { authority: "CANONICAL" } });

    resetState();
    await expect(
      prepareAssignmentClassExpansion({
        actorId: otherTeacherId,
        actorRole: "teacher",
        assignmentId: null,
        classIds: [classId],
        organizationId,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(
      state.calls.some((call) => call.table === "student_class_members"),
    ).toBe(false);
  });

  it("rejects archived, inactive, missing, and cross-tenant Classes fail closed", async () => {
    for (const invalidClass of [
      { ...state.classes[0], status: "archived" },
      { ...state.classes[0], status: "inactive" },
      { ...state.classes[0], organization_id: otherOrganizationId },
      null,
    ]) {
      resetState();
      state.classes = invalidClass ? [invalidClass] : [];
      await expect(
        prepareAssignmentClassExpansion({
          actorId,
          actorRole: "organization_owner",
          assignmentId: null,
          classIds: [classId],
          organizationId,
        }),
      ).rejects.toMatchObject({ code: "invalid_input" });
    }
  });

  it("batches multiple Classes and does not query auth, Profiles, or Account links", async () => {
    state.classes = [
      state.classes[0]!,
      {
        id: secondClassId,
        organization_id: organizationId,
        status: "active",
        teacher_id: actorId,
      },
    ];
    await prepareAssignmentClassExpansion({
      actorId,
      actorRole: "organization_owner",
      assignmentId: null,
      classIds: [classId, secondClassId, classId],
      organizationId,
    });

    expect(
      state.calls.filter(
        (call) => call.table === "classes" && call.operation === "in",
      ),
    ).toHaveLength(1);
    expect(
      state.calls.some((call) =>
        ["auth.users", "profiles", "student_account_links"].includes(
          call.table,
        ),
      ),
    ).toBe(false);
  });

  it("falls back to legacy candidates only for canonical runtime failure", async () => {
    state.canonicalError = new ClassRosterSourceError(
      "CANONICAL_RUNTIME_FAILURE",
    );
    state.legacyEnrollments = [
      {
        class_id: classId,
        id: "60000000-0000-4000-8000-000000000001",
        organization_id: organizationId,
        student_id: "70000000-0000-4000-8000-000000000001",
      },
    ];
    const plan = await prepareAssignmentClassExpansion({
      actorId,
      actorRole: "organization_owner",
      assignmentId: null,
      classIds: [classId],
      organizationId,
    });

    expect(plan.result).toMatchObject({
      authority: "LEGACY",
      fallbackUsed: true,
      identityUnresolvedCount: 0,
      legacyRecipientIds: ["70000000-0000-4000-8000-000000000001"],
    });
  });
});
