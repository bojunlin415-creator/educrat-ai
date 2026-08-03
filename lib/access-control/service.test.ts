import { AccessControlError } from "@/lib/access-control/errors";
import {
  assignAccessRole,
  switchRoleContext,
} from "@/lib/access-control/service";

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

const organizationId = "10000000-0000-4000-8000-000000000001";
const actorId = "10000000-0000-4000-8000-000000000002";
const membershipId = "10000000-0000-4000-8000-000000000003";

describe("UX-001 access-control service", () => {
  afterEach(() => vi.clearAllMocks());

  it("assigns a manageable organization role through the RPC boundary", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: membershipId, error: null });
    dependencyMocks.createClient.mockResolvedValue({ rpc });

    await expect(
      assignAccessRole({
        membershipId,
        reason: "Assign teacher for UX-001 verification",
        role: "teacher",
      }),
    ).resolves.toBe(membershipId);

    expect(rpc).toHaveBeenCalledWith("assign_organization_member_role", {
      p_membership_id: membershipId,
      p_reason: "Assign teacher for UX-001 verification",
      p_role: "teacher",
    });
  });

  it("rejects forged role context when active membership role differs", async () => {
    dependencyMocks.getCurrentUser.mockResolvedValue({ id: actorId });
    dependencyMocks.requireOrganizationMembership.mockResolvedValue({
      membership: {
        role: "teacher",
        status: "active",
        user_id: actorId,
      },
      organization: { id: organizationId },
    });

    await expect(
      switchRoleContext({
        organizationId,
        role: "organization_admin",
      }),
    ).rejects.toEqual(new AccessControlError("forbidden"));
  });

  it("switches active organization only after trusted membership verification", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: organizationId, error: null })
      .mockResolvedValueOnce({ data: "audit-1", error: null });
    dependencyMocks.getCurrentUser.mockResolvedValue({ id: actorId });
    dependencyMocks.requireOrganizationMembership.mockResolvedValue({
      membership: {
        role: "guardian",
        status: "active",
        user_id: actorId,
      },
      organization: { id: organizationId },
    });
    dependencyMocks.createClient.mockResolvedValue({ rpc });

    const context = await switchRoleContext({
      organizationId,
      role: "guardian",
    });

    expect(context.organization.id).toBe(organizationId);
    expect(rpc).toHaveBeenNthCalledWith(1, "switch_active_organization", {
      p_organization_id: organizationId,
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "write_access_control_audit", {
      p_action: "ROLE_CONTEXT_SWITCHED",
      p_actor_id: actorId,
      p_metadata: { role: "guardian" },
      p_organization_id: organizationId,
      p_target_membership_id: null,
    });
  });
});
