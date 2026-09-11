import { saveSubmission, submitAssignment } from "@/lib/assignment/service";

const accountId = "10000000-0000-4000-8000-000000000001";
const organizationId = "20000000-0000-4000-8000-000000000001";
const studentId = "30000000-0000-4000-8000-000000000001";
const assignmentId = "40000000-0000-4000-8000-000000000001";
const submissionId = "50000000-0000-4000-8000-000000000001";

const state = vi.hoisted(() => ({
  resolution: {
    linkId: "60000000-0000-4000-8000-000000000001",
    organizationId: "20000000-0000-4000-8000-000000000001",
    outcome: "linked" as const,
    studentId: "30000000-0000-4000-8000-000000000001",
  } as
    | {
        linkId: string;
        organizationId: string;
        outcome: "linked";
        studentId: string;
      }
    | {
        outcome: "ambiguous_link" | "expired_link" | "no_link" | "revoked_link";
      },
  rpcError: null as { code: string; message: string } | null,
  rpcCalls: [] as { name: string; params: unknown }[],
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn(async () => ({ id: accountId })),
}));

vi.mock("@/lib/organization/service", () => ({
  requireOrganizationMembership: vi.fn(async () => ({
    membership: { role: "student", status: "active", user_id: accountId },
    organization: { id: organizationId },
  })),
  requireOrganizationRole: vi.fn(),
}));

vi.mock("@/lib/learner-convergence/server", () => ({
  resolveCanonicalStudentForAuthenticatedAccount: vi.fn(async () =>
    Object.freeze({ ...state.resolution }),
  ),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc(name: string, params: unknown) {
      state.rpcCalls.push({ name, params });
      return Promise.resolve({
        data: state.rpcError
          ? null
          : {
              assignment_id: assignmentId,
              created_at: "2026-09-07T00:00:00.000Z",
              id: submissionId,
              identity_authority: name.startsWith("save_legacy")
                ? "LEGACY_ONLY_HISTORICAL"
                : "CANONICAL",
              status:
                (params as { p_submit?: boolean }).p_submit === true
                  ? "submitted"
                  : "draft",
              submitted_at:
                (params as { p_submit?: boolean }).p_submit === true
                  ? "2026-09-07T00:01:00.000Z"
                  : null,
              updated_at: "2026-09-07T00:01:00.000Z",
            },
        error: state.rpcError,
      });
    },
  })),
}));

describe("LE-001 Phase 5F Assignment Submission service", () => {
  beforeEach(() => {
    state.resolution = {
      linkId: "60000000-0000-4000-8000-000000000001",
      organizationId,
      outcome: "linked",
      studentId,
    };
    state.rpcError = null;
    state.rpcCalls.splice(0);
    delete process.env.LEARNER_SUBMISSION_SELF_AUTHORITY_MODE;
  });

  it("saves through canonical RPC without accepting learner or tenant authority", async () => {
    await expect(
      saveSubmission(assignmentId, { content: { q1: "answer" } }),
    ).resolves.toMatchObject({
      identity_authority: "CANONICAL",
      status: "draft",
    });
    expect(state.rpcCalls).toEqual([
      {
        name: "save_authenticated_student_submission",
        params: {
          p_assignment_id: assignmentId,
          p_content: { q1: "answer" },
          p_submit: false,
        },
      },
    ]);
    expect(JSON.stringify(state.rpcCalls)).not.toContain(studentId);
    expect(JSON.stringify(state.rpcCalls)).not.toContain(organizationId);
    expect(JSON.stringify(state.rpcCalls)).not.toContain(accountId);
  });

  it("submits canonically in one RPC and does not run a legacy write fallback", async () => {
    await expect(
      submitAssignment(assignmentId, { content: { q1: "answer" } }),
    ).resolves.toMatchObject({
      identity_authority: "CANONICAL",
      status: "submitted",
    });
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0]).toMatchObject({
      name: "save_authenticated_student_submission",
      params: { p_submit: true },
    });

    state.rpcCalls.splice(0);
    state.rpcError = { code: "XX000", message: "canonical_failure" };
    await expect(
      saveSubmission(assignmentId, { content: { q1: "answer" } }),
    ).rejects.toMatchObject({ code: "service_unavailable" });
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0]?.name).toBe(
      "save_authenticated_student_submission",
    );
  });

  it.each([
    ["no_link", "student_account_link_missing"],
    ["revoked_link", "student_account_link_inactive"],
    ["expired_link", "student_account_link_expired"],
    ["ambiguous_link", "student_identity_conflict"],
  ] as const)(
    "fails closed for %s before persistence",
    async (outcome, code) => {
      state.resolution = { outcome };
      await expect(
        saveSubmission(assignmentId, { content: { q1: "answer" } }),
      ).rejects.toMatchObject({ code });
      expect(state.rpcCalls).toHaveLength(0);
    },
  );

  it("supports an explicit LEGACY_ONLY runtime rollback without rewriting canonical ownership", async () => {
    process.env.LEARNER_SUBMISSION_SELF_AUTHORITY_MODE = "LEGACY_ONLY";
    await expect(
      saveSubmission(assignmentId, { content: { q1: "answer" } }),
    ).resolves.toMatchObject({
      identity_authority: "LEGACY_ONLY_HISTORICAL",
    });
    expect(state.rpcCalls[0]?.name).toBe(
      "save_legacy_authenticated_student_submission",
    );
  });
});
