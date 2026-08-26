import { AssignmentError } from "@/lib/assignment/errors";
import { createAssignment } from "@/lib/assignment/service";

const organizationId = "10000000-0000-4000-8000-000000000001";
const classId = "30000000-0000-4000-8000-000000000001";
const curriculumId = "40000000-0000-4000-8000-000000000001";
const versionId = "50000000-0000-4000-8000-000000000001";

const state = vi.hoisted(() => ({
  tables: [] as string[],
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn(async () => ({
    id: "20000000-0000-4000-8000-000000000001",
  })),
}));

vi.mock("@/lib/organization/service", () => ({
  requireOrganizationMembership: vi.fn(async () => ({
    membership: {
      role: "organization_owner",
      status: "active",
      user_id: "20000000-0000-4000-8000-000000000001",
    },
    organization: { id: "10000000-0000-4000-8000-000000000001" },
  })),
  requireOrganizationRole: vi.fn(async () => ({
    membership: {
      role: "organization_owner",
      status: "active",
      user_id: "20000000-0000-4000-8000-000000000001",
    },
    organization: { id: "10000000-0000-4000-8000-000000000001" },
  })),
}));

vi.mock("@/lib/assignment/class-expansion", () => ({
  prepareAssignmentClassExpansion: vi.fn(async () => ({
    classIds: ["30000000-0000-4000-8000-000000000001"],
    organizationId: "10000000-0000-4000-8000-000000000001",
    result: {
      identityUnresolvedCount: 1,
      legacyRecipientIds: [],
    },
  })),
  requireMaterializableAssignmentRecipients: vi.fn(() => {
    throw new AssignmentError("recipient_identity_unavailable");
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from(table: string) {
      state.tables.push(table);
      const data =
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
            : null;
      const query = {
        eq() {
          return query;
        },
        is() {
          return query;
        },
        maybeSingle() {
          return Promise.resolve({ data, error: null });
        },
        select() {
          return query;
        },
      };
      return query;
    },
  })),
}));

describe("LE-001 Phase 5D Assignment write boundary", () => {
  beforeEach(() => state.tables.splice(0));

  it("returns the compatibility error before Assignment, target, or recipient persistence", async () => {
    await expect(
      createAssignment({
        classIds: [classId],
        curriculumId,
        curriculumVersionId: versionId,
        dueAt: "2026-09-10T10:00:00.000Z",
        publishAt: "2026-09-01T10:00:00.000Z",
        title: "Phase 5D canonical expansion",
      }),
    ).rejects.toMatchObject({ code: "recipient_identity_unavailable" });

    expect(state.tables).toEqual(["curriculums", "curriculum_versions"]);
    expect(state.tables).not.toContain("assignments");
    expect(state.tables).not.toContain("assignment_classes");
    expect(state.tables).not.toContain("assignment_students");
  });
});
