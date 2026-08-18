import { OrganizationError } from "@/lib/organization/errors";
import {
  analyzeCurrentOrganizationLearnerParity,
  resolveCanonicalStudentForAuthenticatedAccount,
} from "@/lib/learner-convergence/infrastructure/supabase";

const dependencies = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentUser: vi.fn(),
  requireOrganizationMembership: vi.fn(),
  requireOrganizationRole: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: dependencies.getCurrentUser,
}));
vi.mock("@/lib/organization/service", () => ({
  requireOrganizationMembership: dependencies.requireOrganizationMembership,
  requireOrganizationRole: dependencies.requireOrganizationRole,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: dependencies.createClient,
}));

const organizationId = "10000000-0000-4000-8000-000000000001";
const accountId = "20000000-0000-4000-8000-000000000001";
const studentId = "30000000-0000-4000-8000-000000000001";
const linkId = "40000000-0000-4000-8000-000000000001";

function context(role = "organization_owner") {
  return {
    membership: { role, status: "active", user_id: accountId },
    organization: { id: organizationId },
  };
}

function emptySnapshot() {
  return {
    accountLinks: [],
    assignmentRecipients: [],
    asOf: "2026-08-18T00:00:00.000Z",
    canonicalEnrollments: [],
    canonicalStudents: [],
    eligibleProfileStudents: [],
    guardianRelationships: [],
    learningEvents: [],
    legacyEnrollments: [],
    masteryRecords: [],
    organizationId,
    submissions: [],
    version: "le-001.v1",
  };
}

describe("LE-001 Supabase boundary", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("loads a minimal owner/admin snapshot only through the scoped RPC", async () => {
    dependencies.requireOrganizationRole.mockResolvedValue(context());
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: emptySnapshot(), error: null });
    dependencies.createClient.mockResolvedValue({ rpc });
    const log = vi.spyOn(console, "info").mockImplementation(() => {});

    const report = await analyzeCurrentOrganizationLearnerParity();

    expect(dependencies.requireOrganizationRole).toHaveBeenCalledWith([
      "organization_owner",
      "organization_admin",
    ]);
    expect(rpc).toHaveBeenCalledWith("get_learner_convergence_snapshot");
    expect(report.organizationId).toBe(organizationId);
    expect(log).toHaveBeenCalledWith(
      "[learner-convergence]",
      expect.not.stringContaining("email"),
    );
  });

  it("fails closed before loading parity data for ordinary members", async () => {
    dependencies.requireOrganizationRole.mockRejectedValue(
      new OrganizationError("forbidden"),
    );

    await expect(
      analyzeCurrentOrganizationLearnerParity(),
    ).rejects.toMatchObject({ code: "forbidden" });
    expect(dependencies.createClient).not.toHaveBeenCalled();
  });

  it("resolves self identity without accepting a caller-supplied student id", async () => {
    dependencies.getCurrentUser.mockResolvedValue({ id: accountId });
    dependencies.requireOrganizationMembership.mockResolvedValue(
      context("student"),
    );
    const rpc = vi.fn().mockResolvedValue({
      data: { linkId, organizationId, outcome: "linked", studentId },
      error: null,
    });
    dependencies.createClient.mockResolvedValue({ rpc });

    await expect(
      resolveCanonicalStudentForAuthenticatedAccount(),
    ).resolves.toEqual({
      linkId,
      organizationId,
      outcome: "linked",
      studentId,
    });
    expect(rpc).toHaveBeenCalledWith(
      "resolve_canonical_student_for_authenticated_account",
    );
  });

  it.each([
    "no_link",
    "ambiguous_link",
    "revoked_link",
    "expired_link",
    "wrong_organization",
  ] as const)("preserves the typed %s outcome", async (outcome) => {
    dependencies.getCurrentUser.mockResolvedValue({ id: accountId });
    dependencies.requireOrganizationMembership.mockResolvedValue(
      context("student"),
    );
    dependencies.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: { outcome }, error: null }),
    });

    await expect(
      resolveCanonicalStudentForAuthenticatedAccount(),
    ).resolves.toEqual({ outcome });
  });

  it("returns inactive_context when active membership cannot be resolved", async () => {
    dependencies.getCurrentUser.mockResolvedValue({ id: accountId });
    dependencies.requireOrganizationMembership.mockRejectedValue(
      new OrganizationError("organization_not_found"),
    );

    await expect(
      resolveCanonicalStudentForAuthenticatedAccount(),
    ).resolves.toEqual({ outcome: "inactive_context" });
    expect(dependencies.createClient).not.toHaveBeenCalled();
  });

  it("rejects a forged linked result for another organization", async () => {
    dependencies.getCurrentUser.mockResolvedValue({ id: accountId });
    dependencies.requireOrganizationMembership.mockResolvedValue(
      context("student"),
    );
    dependencies.createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: {
          linkId,
          organizationId: "10000000-0000-4000-8000-000000000002",
          outcome: "linked",
          studentId,
        },
        error: null,
      }),
    });

    await expect(
      resolveCanonicalStudentForAuthenticatedAccount(),
    ).rejects.toMatchObject({ code: "invalid_snapshot" });
  });
});
