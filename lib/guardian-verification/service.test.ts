import { GuardianVerificationError } from "@/lib/guardian-verification/errors";
import {
  acceptGuardianInvitation,
  createGuardianInvitation,
  hashGuardianInvitationToken,
  previewGuardianInvitation,
  revokeGuardianRelationship,
} from "@/lib/guardian-verification/service";

const dependencyMocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getCurrentUser: vi.fn(),
  requireOrganizationRole: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: dependencyMocks.getCurrentUser,
}));

vi.mock("@/lib/organization/service", () => ({
  requireOrganizationRole: dependencyMocks.requireOrganizationRole,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: dependencyMocks.createClient,
}));

const organizationId = "10000000-0000-4000-8000-000000000001";
const adminId = "10000000-0000-4000-8000-000000000002";
const guardianId = "10000000-0000-4000-8000-000000000003";
const studentId = "10000000-0000-4000-8000-000000000004";
const token = "safe-token-abcdefghijklmnopqrstuvwxyz012345";

type Row = Readonly<Record<string, unknown>>;

function createQuery(rows: readonly Row[], inserts: Row[]) {
  let currentRows = [...rows];
  const query = {
    eq(column: string, value: unknown) {
      currentRows = currentRows.filter((row) => row[column] === value);
      return query;
    },
    insert(row: Row) {
      inserts.push(row);
      return {
        select() {
          return {
            single() {
              return Promise.resolve({
                data: { ...row, id: "invitation-1" },
                error: null,
              });
            },
          };
        },
      };
    },
    maybeSingle() {
      return Promise.resolve({ data: currentRows[0] ?? null, error: null });
    },
    select() {
      return query;
    },
  };
  return query;
}

function installAccess() {
  dependencyMocks.getCurrentUser.mockResolvedValue({
    email: "guardian@example.com",
    id: adminId,
  });
  dependencyMocks.requireOrganizationRole.mockResolvedValue({
    membership: { role: "organization_admin", user_id: adminId },
    organization: { id: organizationId },
  });
}

function installSupabase(
  rowsByTable: Readonly<Record<string, readonly Row[]>>,
) {
  const inserts: Row[] = [];
  dependencyMocks.createClient.mockResolvedValue({
    from: (table: string) => createQuery(rowsByTable[table] ?? [], inserts),
    rpc: vi.fn().mockResolvedValue({ data: "relationship-1", error: null }),
  });
  return inserts;
}

describe("GV-001 guardian verification service", () => {
  afterEach(() => vi.clearAllMocks());

  it("creates an organization-issued invitation without storing raw token", async () => {
    installAccess();
    const inserts = installSupabase({
      organization_members: [
        {
          id: "student-membership-1",
          organization_id: organizationId,
          role: "student",
          status: "active",
          user_id: studentId,
        },
      ],
      profiles: [{ display_name: "小晴", id: studentId }],
    });

    const invitation = await createGuardianInvitation({
      guardianEmail: "Guardian@Example.com",
      relationshipType: "parent",
      studentId,
    });

    expect(invitation.rawToken).toBeTruthy();
    expect(invitation.invitationUrl).toContain(invitation.rawToken);
    const invitationInsert = inserts.find((insert) => insert.token_hash) as
      Row | undefined;
    expect(invitationInsert?.guardian_email_normalized).toBe(
      "guardian@example.com",
    );
    expect(invitationInsert?.token_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(invitationInsert).not.toHaveProperty("rawToken");
  });

  it("fails closed when target student is not an active student member", async () => {
    installAccess();
    installSupabase({ organization_members: [] });

    await expect(
      createGuardianInvitation({
        guardianEmail: "guardian@example.com",
        relationshipType: "parent",
        studentId,
      }),
    ).rejects.toEqual(new GuardianVerificationError("not_found"));
  });

  it("previews only a pending invitation for the logged-in email", async () => {
    dependencyMocks.getCurrentUser.mockResolvedValue({
      email: "guardian@example.com",
      id: guardianId,
    });
    installSupabase({
      guardian_invitations: [
        {
          expires_at: new Date(Date.now() + 60_000).toISOString(),
          guardian_email_normalized: "guardian@example.com",
          id: "invitation-1",
          organization_id: organizationId,
          relationship_type: "parent",
          status: "pending",
          student_id: studentId,
          token_hash: hashGuardianInvitationToken(token),
        },
      ],
      profiles: [{ display_name: "小晴", id: studentId }],
    });

    const preview = await previewGuardianInvitation({ token });

    expect(preview.studentDisplayName).toBe("小晴");
    expect(preview.studentId).toBe(studentId);
  });

  it("rejects expired invitation preview", async () => {
    dependencyMocks.getCurrentUser.mockResolvedValue({
      email: "guardian@example.com",
      id: guardianId,
    });
    installSupabase({
      guardian_invitations: [
        {
          expires_at: new Date(Date.now() - 60_000).toISOString(),
          guardian_email_normalized: "guardian@example.com",
          id: "invitation-1",
          organization_id: organizationId,
          relationship_type: "parent",
          status: "pending",
          student_id: studentId,
          token_hash: hashGuardianInvitationToken(token),
        },
      ],
    });

    await expect(previewGuardianInvitation({ token })).rejects.toEqual(
      new GuardianVerificationError("expired"),
    );
  });

  it("accepts by passing only token hash and consent version to the RPC", async () => {
    dependencyMocks.getCurrentUser.mockResolvedValue({
      email: "guardian@example.com",
      id: guardianId,
    });
    const rpc = vi.fn().mockResolvedValue({
      data: "relationship-1",
      error: null,
    });
    dependencyMocks.createClient.mockResolvedValue({
      rpc,
    });

    const result = await acceptGuardianInvitation({
      consentVersion: "guardian-consent-v1",
      token,
    });

    expect(result.relationshipId).toBe("relationship-1");
    expect(rpc).toHaveBeenCalledWith("accept_guardian_invitation", {
      p_consent_version: "guardian-consent-v1",
      p_token_hash: hashGuardianInvitationToken(token),
    });
    expect(JSON.stringify(rpc.mock.calls)).not.toContain(token);
  });

  it("revokes an active relationship through admin RPC boundary", async () => {
    installAccess();
    const rpc = vi.fn().mockResolvedValue({
      data: "relationship-1",
      error: null,
    });
    dependencyMocks.createClient.mockResolvedValue({
      rpc,
    });

    const result = await revokeGuardianRelationship({
      reason: "Guardian verification E2E cleanup",
      relationshipId: "10000000-0000-4000-8000-000000000006",
    });

    expect(result.relationshipId).toBe("relationship-1");
    expect(rpc).toHaveBeenCalledWith("revoke_guardian_relationship", {
      p_reason: "Guardian verification E2E cleanup",
      p_relationship_id: "10000000-0000-4000-8000-000000000006",
    });
  });
});
