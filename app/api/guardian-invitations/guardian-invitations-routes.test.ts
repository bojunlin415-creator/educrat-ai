import { GuardianVerificationError } from "@/lib/guardian-verification/errors";
import { POST as createInvitation } from "./route";
import { POST as acceptInvitation } from "./accept/route";
import { GET as previewInvitation } from "./preview/route";
import { POST as revokeRelationship } from "../guardian-relationships/[relationshipId]/revoke/route";

const serviceMocks = vi.hoisted(() => ({
  acceptGuardianInvitation: vi.fn(),
  createGuardianInvitation: vi.fn(),
  previewGuardianInvitation: vi.fn(),
  revokeGuardianRelationship: vi.fn(),
}));

vi.mock("@/lib/guardian-verification/service", () => serviceMocks);

const token = "safe-token-abcdefghijklmnopqrstuvwxyz012345";
const studentId = "10000000-0000-4000-8000-000000000004";
const relationshipId = "10000000-0000-4000-8000-000000000006";

describe("GV-001 guardian invitation API", () => {
  afterEach(() => vi.clearAllMocks());

  it("creates invitation through service boundary", async () => {
    serviceMocks.createGuardianInvitation.mockResolvedValue({
      invitationId: "invitation-1",
      invitationUrl: `http://localhost:3000/guardian-invitations/accept?token=${token}`,
    });

    const response = await createInvitation(
      new Request("http://localhost/api/guardian-invitations", {
        body: JSON.stringify({
          guardianEmail: "guardian@example.com",
          relationshipType: "parent",
          studentId,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(serviceMocks.createGuardianInvitation).toHaveBeenCalledWith({
      guardianEmail: "guardian@example.com",
      relationshipType: "parent",
      studentId,
    });
  });

  it("validates create input before service access", async () => {
    const response = await createInvitation(
      new Request("http://localhost/api/guardian-invitations", {
        body: JSON.stringify({
          guardianEmail: "not-an-email",
          relationshipType: "parent",
          studentId,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(422);
    expect(serviceMocks.createGuardianInvitation).not.toHaveBeenCalled();
  });

  it("previews invitation using token query", async () => {
    serviceMocks.previewGuardianInvitation.mockResolvedValue({
      studentDisplayName: "小晴",
    });

    const response = await previewInvitation(
      new Request(
        `http://localhost/api/guardian-invitations/preview?token=${token}`,
      ),
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.previewGuardianInvitation).toHaveBeenCalledWith({
      token,
    });
  });

  it("accepts invitation only with consent version", async () => {
    serviceMocks.acceptGuardianInvitation.mockResolvedValue({
      relationshipId: "relationship-1",
    });

    const response = await acceptInvitation(
      new Request("http://localhost/api/guardian-invitations/accept", {
        body: JSON.stringify({
          consentVersion: "guardian-consent-v1",
          token,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.acceptGuardianInvitation).toHaveBeenCalledWith({
      consentVersion: "guardian-consent-v1",
      token,
    });
  });

  it("returns safe email mismatch error", async () => {
    serviceMocks.acceptGuardianInvitation.mockRejectedValue(
      new GuardianVerificationError("email_mismatch"),
    );

    const response = await acceptInvitation(
      new Request("http://localhost/api/guardian-invitations/accept", {
        body: JSON.stringify({
          consentVersion: "guardian-consent-v1",
          token,
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("token_hash");
  });

  it("revokes relationship through service boundary", async () => {
    serviceMocks.revokeGuardianRelationship.mockResolvedValue({
      relationshipId,
    });

    const response = await revokeRelationship(
      new Request(
        `http://localhost/api/guardian-relationships/${relationshipId}/revoke`,
        {
          body: JSON.stringify({ reason: "E2E relationship cleanup" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      ),
      { params: Promise.resolve({ relationshipId }) },
    );

    expect(response.status).toBe(200);
    expect(serviceMocks.revokeGuardianRelationship).toHaveBeenCalledWith({
      reason: "E2E relationship cleanup",
      relationshipId,
    });
  });

  it("validates revoke reason before service access", async () => {
    const response = await revokeRelationship(
      new Request(
        `http://localhost/api/guardian-relationships/${relationshipId}/revoke`,
        {
          body: JSON.stringify({ reason: "" }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      ),
      { params: Promise.resolve({ relationshipId }) },
    );

    expect(response.status).toBe(422);
    expect(serviceMocks.revokeGuardianRelationship).not.toHaveBeenCalled();
  });
});
