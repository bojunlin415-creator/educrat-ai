import { AccessControlError } from "@/lib/access-control/errors";
import {
  assignAccessRole,
  disableAccessMember,
  enableAccessMember,
  removeAccessRole,
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
  beforeEach(() => {
    dependencyMocks.getCurrentUser.mockResolvedValue({ id: actorId });
    dependencyMocks.requireOrganizationRole.mockResolvedValue({
      membership: {
        id: "10000000-0000-4000-8000-000000000004",
        role: "organization_owner",
        status: "active",
        user_id: actorId,
      },
      organization: { id: organizationId },
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("assigns a manageable organization role through the RPC boundary", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: membershipId, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: membershipId, organization_id: organizationId },
      error: null,
    });
    const eqOrganization = vi.fn().mockReturnValue({ maybeSingle });
    const eqId = vi.fn().mockReturnValue({ eq: eqOrganization });
    const select = vi.fn().mockReturnValue({ eq: eqId });
    dependencyMocks.createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue({ select }),
      rpc,
    });

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
    expect(dependencyMocks.requireOrganizationRole).toHaveBeenCalledWith([
      "organization_owner",
      "organization_admin",
    ]);
    expect(eqOrganization).toHaveBeenCalledWith(
      "organization_id",
      organizationId,
    );
  });

  it("maps the RPC self-role guard to a dedicated domain error", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42501", message: "self_elevation_forbidden" },
    });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: membershipId, organization_id: organizationId },
      error: null,
    });
    const eqOrganization = vi.fn().mockReturnValue({ maybeSingle });
    const eqId = vi.fn().mockReturnValue({ eq: eqOrganization });
    const select = vi.fn().mockReturnValue({ eq: eqId });
    dependencyMocks.createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue({ select }),
      rpc,
    });

    await expect(
      assignAccessRole({
        membershipId,
        reason: "Attempt self role change",
        role: "teacher",
      }),
    ).rejects.toEqual(new AccessControlError("self_elevation_forbidden"));
  });

  it("still allows an owner to promote and demote another member", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: membershipId, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: membershipId, organization_id: organizationId },
      error: null,
    });
    const eqOrganization = vi.fn().mockReturnValue({ maybeSingle });
    const eqId = vi.fn().mockReturnValue({ eq: eqOrganization });
    const select = vi.fn().mockReturnValue({ eq: eqId });
    dependencyMocks.createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue({ select }),
      rpc,
    });

    await expect(
      assignAccessRole({
        membershipId,
        reason: "Promote another member",
        role: "organization_admin",
      }),
    ).resolves.toBe(membershipId);
    await expect(
      assignAccessRole({
        membershipId,
        reason: "Demote another member",
        role: "teacher",
      }),
    ).resolves.toBe(membershipId);

    expect(rpc).toHaveBeenNthCalledWith(1, "assign_organization_member_role", {
      p_membership_id: membershipId,
      p_reason: "Promote another member",
      p_role: "organization_admin",
    });
    expect(rpc).toHaveBeenNthCalledWith(2, "assign_organization_member_role", {
      p_membership_id: membershipId,
      p_reason: "Demote another member",
      p_role: "teacher",
    });
  });

  it("rejects a target membership outside the active organization before RPC", async () => {
    const rpc = vi.fn();
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqOrganization = vi.fn().mockReturnValue({ maybeSingle });
    const eqId = vi.fn().mockReturnValue({ eq: eqOrganization });
    const select = vi.fn().mockReturnValue({ eq: eqId });
    dependencyMocks.createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue({ select }),
      rpc,
    });

    await expect(
      assignAccessRole({
        membershipId,
        reason: "Reject cross-organization mutation",
        role: "teacher",
      }),
    ).rejects.toEqual(new AccessControlError("not_found"));

    expect(rpc).not.toHaveBeenCalled();
  });

  it("uses the shared manager authorization path for every member mutation", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: membershipId, error: null });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: membershipId, organization_id: organizationId },
      error: null,
    });
    const eqOrganization = vi.fn().mockReturnValue({ maybeSingle });
    const eqId = vi.fn().mockReturnValue({ eq: eqOrganization });
    const select = vi.fn().mockReturnValue({ eq: eqId });
    dependencyMocks.createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue({ select }),
      rpc,
    });

    await assignAccessRole({
      membershipId,
      reason: "Assign through shared authorization",
      role: "teacher",
    });
    await enableAccessMember({
      membershipId,
      reason: "Enable through shared authorization",
    });
    await disableAccessMember({
      membershipId,
      reason: "Disable through shared authorization",
    });
    await removeAccessRole({
      membershipId,
      reason: "Remove through shared authorization",
    });

    expect(dependencyMocks.requireOrganizationRole).toHaveBeenCalledTimes(4);
    expect(dependencyMocks.requireOrganizationRole).toHaveBeenCalledWith([
      "organization_owner",
      "organization_admin",
    ]);
    expect(rpc).toHaveBeenCalledTimes(4);
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
