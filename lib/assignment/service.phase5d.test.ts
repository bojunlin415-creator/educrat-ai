import { createAssignment } from "@/lib/assignment/service";

const organizationId = "10000000-0000-4000-8000-000000000001";
const actorId = "20000000-0000-4000-8000-000000000001";
const classId = "30000000-0000-4000-8000-000000000001";
const curriculumId = "40000000-0000-4000-8000-000000000001";
const versionId = "50000000-0000-4000-8000-000000000001";
const canonicalStudentId = "60000000-0000-4000-8000-000000000001";
const assignmentId = "70000000-0000-4000-8000-000000000001";
const recipientId = "80000000-0000-4000-8000-000000000001";

const state = vi.hoisted(() => ({
  canonicalWriteError: null as { code: string; message: string } | null,
  rpcCalls: [] as { name: string; params: unknown }[],
  tables: [] as string[],
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn(async () => ({ id: actorId })),
}));

vi.mock("@/lib/organization/service", () => ({
  requireOrganizationMembership: vi.fn(async () => ({
    membership: {
      role: "organization_owner",
      status: "active",
      user_id: actorId,
    },
    organization: { id: organizationId },
  })),
  requireOrganizationRole: vi.fn(async () => ({
    membership: {
      role: "organization_owner",
      status: "active",
      user_id: actorId,
    },
    organization: { id: organizationId },
  })),
}));

vi.mock("@/lib/assignment/class-expansion", () => ({
  prepareAssignmentClassExpansion: vi.fn(async () => ({
    classIds: [classId],
    organizationId,
    result: {
      authority: "CANONICAL",
      candidates: [
        {
          canonicalStudentId,
          classIds: [classId],
          legacyRecipientId: null,
          membershipIds: ["90000000-0000-4000-8000-000000000001"],
          organizationId,
          source: "CANONICAL",
        },
      ],
      canonicalCandidateCount: 1,
      compatibilityMappedCount: 0,
      expectedAccountlessCandidateCount: 1,
      fallbackUsed: false,
      identityUnresolvedCount: 1,
      legacyCandidateCount: null,
      legacyRecipientIds: [],
      mode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
      shadowErrorCount: 0,
      version: "le-001.assignment-class-expansion.v1",
    },
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from(table: string) {
      state.tables.push(table);
      const result =
        table === "curriculums"
          ? {
              id: curriculumId,
              organization_id: organizationId,
              status: "published",
            }
          : table === "curriculum_versions"
            ? {
                curriculum_id: curriculumId,
                id: versionId,
                status: "published",
              }
            : table === "assignments"
              ? {
                  assigned_by: actorId,
                  created_at: "2026-09-02T00:00:00.000Z",
                  curriculum_id: curriculumId,
                  curriculum_version_id: versionId,
                  description: null,
                  due_at: "2026-09-10T10:00:00.000Z",
                  id: assignmentId,
                  organization_id: organizationId,
                  publish_at: "2026-09-01T10:00:00.000Z",
                  status: "scheduled",
                  title: "Managed learner assignment",
                  updated_at: "2026-09-02T00:00:00.000Z",
                }
              : table === "assignment_classes"
                ? [
                    {
                      assigned_at: "2026-09-02T00:00:00.000Z",
                      assignment_id: assignmentId,
                      class_id: classId,
                      organization_id: organizationId,
                    },
                  ]
                : null;
      const query = {
        eq() {
          return query;
        },
        is() {
          return query;
        },
        maybeSingle() {
          return Promise.resolve({ data: result, error: null });
        },
        order() {
          return Promise.resolve({ data: result, error: null });
        },
        select() {
          return query;
        },
      };
      return query;
    },
    rpc(name: string, params: unknown) {
      state.rpcCalls.push({ name, params });
      if (name === "create_assignment_with_canonical_recipients") {
        return Promise.resolve({
          data: state.canonicalWriteError ? null : assignmentId,
          error: state.canonicalWriteError,
        });
      }
      if (name === "get_assignment_recipient_projection") {
        return Promise.resolve({
          data: [
            {
              assigned_at: "2026-09-02T00:00:00.000Z",
              assignment_id: assignmentId,
              canonical_student_id: canonicalStudentId,
              identity_authority: "CANONICAL",
              recipient_id: recipientId,
              recipient_status: "not_started",
              source_class_ids: [classId],
            },
          ],
          error: null,
        });
      }
      throw new Error(`Unexpected RPC: ${name}`);
    },
  })),
}));

describe("LE-001 Phase 5E Assignment write boundary", () => {
  beforeEach(() => {
    state.canonicalWriteError = null;
    state.rpcCalls.splice(0);
    state.tables.splice(0);
    delete process.env.LEARNER_ASSIGNMENT_RECIPIENT_AUTHORITY_MODE;
  });

  it("persists a managed/accountless canonical Student without requiring a legacy identity", async () => {
    const assignment = await createAssignment({
      classIds: [classId],
      curriculumId,
      curriculumVersionId: versionId,
      dueAt: "2026-09-10T10:00:00.000Z",
      publishAt: "2026-09-01T10:00:00.000Z",
      title: "Managed learner assignment",
    });

    expect(assignment.recipients).toEqual([
      expect.objectContaining({
        canonical_student_id: canonicalStudentId,
        identity_authority: "CANONICAL",
      }),
    ]);
    expect(state.rpcCalls[0]).toEqual({
      name: "create_assignment_with_canonical_recipients",
      params: expect.objectContaining({
        p_expected_class_student_ids: [canonicalStudentId],
        p_write_legacy_compatibility: true,
      }),
    });
    expect(state.tables).not.toContain("assignment_students");
  });

  it("fails closed after a canonical write failure and never retries legacy storage", async () => {
    state.canonicalWriteError = {
      code: "XX000",
      message: "canonical_runtime_failure",
    };

    await expect(
      createAssignment({
        classIds: [classId],
        curriculumId,
        curriculumVersionId: versionId,
        dueAt: "2026-09-10T10:00:00.000Z",
        publishAt: "2026-09-01T10:00:00.000Z",
        title: "Fail closed assignment",
      }),
    ).rejects.toMatchObject({ code: "recipient_persistence_unavailable" });

    expect(state.rpcCalls).toHaveLength(1);
    expect(state.tables).not.toContain("assignments");
    expect(state.tables).not.toContain("assignment_students");
  });
});
