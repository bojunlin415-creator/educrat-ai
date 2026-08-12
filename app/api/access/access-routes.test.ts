import { AccessControlError } from "@/lib/access-control/errors";
import { POST as assignRole } from "./roles/assign/route";
import { DELETE as removeMember } from "./members/[membershipId]/route";
import { POST as disableMember } from "./members/[membershipId]/disable/route";
import { POST as enableMember } from "./members/[membershipId]/enable/route";

const serviceMocks = vi.hoisted(() => ({
  assignAccessRole: vi.fn(),
  disableAccessMember: vi.fn(),
  enableAccessMember: vi.fn(),
  removeAccessRole: vi.fn(),
}));

vi.mock("@/lib/access-control/service", () => serviceMocks);

const membershipId = "606ed3c9-9df7-49e4-8b98-d4c123e5ccc4";

function jsonRequest(url: string, body: unknown, method = "POST") {
  return new Request(url, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method,
  });
}

function params() {
  return { params: Promise.resolve({ membershipId }) };
}

describe("UX-001 access management routes", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("serves the assign-role endpoint without a 404", async () => {
    serviceMocks.assignAccessRole.mockResolvedValue(membershipId);

    const response = await assignRole(
      jsonRequest("http://localhost/api/access/roles/assign", {
        membershipId,
        reason: "Assign role safely",
        role: "teacher",
      }),
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.assignAccessRole).toHaveBeenCalledWith({
      membershipId,
      reason: "Assign role safely",
      role: "teacher",
    });
  });

  it("serves enable and disable member endpoints without a 404", async () => {
    serviceMocks.enableAccessMember.mockResolvedValue(membershipId);
    serviceMocks.disableAccessMember.mockResolvedValue(membershipId);

    const enableResponse = await enableMember(
      jsonRequest(`http://localhost/api/access/members/${membershipId}/enable`, {
        reason: "Enable member safely",
      }),
      params(),
    );
    const disableResponse = await disableMember(
      jsonRequest(
        `http://localhost/api/access/members/${membershipId}/disable`,
        { reason: "Disable member safely" },
      ),
      params(),
    );

    expect(enableResponse.status).toBe(200);
    expect(disableResponse.status).toBe(200);
    expect(serviceMocks.enableAccessMember).toHaveBeenCalledWith({
      membershipId,
      reason: "Enable member safely",
    });
    expect(serviceMocks.disableAccessMember).toHaveBeenCalledWith({
      membershipId,
      reason: "Disable member safely",
    });
  });

  it("serves member removal through DELETE without a 404", async () => {
    serviceMocks.removeAccessRole.mockResolvedValue(membershipId);

    const response = await removeMember(
      jsonRequest(
        `http://localhost/api/access/members/${membershipId}`,
        { reason: "Remove member safely" },
        "DELETE",
      ),
      params(),
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.removeAccessRole).toHaveBeenCalledWith({
      membershipId,
      reason: "Remove member safely",
    });
  });

  it("returns 403 for ordinary members denied by the service boundary", async () => {
    serviceMocks.assignAccessRole.mockRejectedValue(
      new AccessControlError("forbidden"),
    );

    const response = await assignRole(
      jsonRequest("http://localhost/api/access/roles/assign", {
        membershipId,
        reason: "Assign role safely",
        role: "teacher",
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("stack");
  });

  it("returns a dedicated conflict for a forbidden self role change", async () => {
    serviceMocks.assignAccessRole.mockRejectedValue(
      new AccessControlError("self_elevation_forbidden"),
    );

    const response = await assignRole(
      jsonRequest("http://localhost/api/access/roles/assign", {
        membershipId,
        reason: "Attempt self role change",
        role: "teacher",
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      code: "self_elevation_forbidden",
      message: "不能修改自己的角色。",
      success: false,
    });
  });

  it("returns 400 for invalid payloads before service access", async () => {
    const response = await assignRole(
      jsonRequest("http://localhost/api/access/roles/assign", {
        membershipId,
        role: "teacher",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      details: {
        fieldErrors: {
          reason: expect.any(Array),
        },
      },
      error: "請修正標示的存取管理欄位。",
      success: false,
    });
    expect(serviceMocks.assignAccessRole).not.toHaveBeenCalled();
  });

  it("returns 400 details for invalid member route params", async () => {
    const response = await enableMember(
      jsonRequest("http://localhost/api/access/members/not-a-uuid/enable", {
        reason: "Enable member safely",
      }),
      { params: Promise.resolve({ membershipId: "not-a-uuid" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      details: {
        formErrors: expect.any(Array),
      },
      error: "請修正標示的存取管理欄位。",
      success: false,
    });
    expect(serviceMocks.enableAccessMember).not.toHaveBeenCalled();
  });

  it("rejects cross-organization membership IDs through the service boundary", async () => {
    serviceMocks.enableAccessMember.mockRejectedValue(
      new AccessControlError("forbidden"),
    );

    const response = await enableMember(
      jsonRequest(`http://localhost/api/access/members/${membershipId}/enable`, {
        reason: "Enable member safely",
      }),
      params(),
    );

    expect(response.status).toBe(403);
  });

  it("preserves last-active-owner protection for demotion and removal", async () => {
    serviceMocks.assignAccessRole.mockRejectedValueOnce(
      new AccessControlError("forbidden"),
    );
    serviceMocks.removeAccessRole.mockRejectedValueOnce(
      new AccessControlError("last_owner"),
    );

    const demoteResponse = await assignRole(
      jsonRequest("http://localhost/api/access/roles/assign", {
        membershipId,
        reason: "Demote owner safely",
        role: "organization_admin",
      }),
    );
    const removeResponse = await removeMember(
      jsonRequest(
        `http://localhost/api/access/members/${membershipId}`,
        { reason: "Remove owner safely" },
        "DELETE",
      ),
      params(),
    );

    expect(demoteResponse.status).toBe(403);
    expect(removeResponse.status).toBe(409);
  });
});
