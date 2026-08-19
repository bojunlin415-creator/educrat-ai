import { decideClassRosterAccess } from "@/lib/learner-convergence/class-roster/access";
import type {
  ClassRosterActorContext,
  ClassRosterClassReference,
} from "@/lib/learner-convergence/class-roster/domain";

const actor: ClassRosterActorContext = {
  accountId: "10000000-0000-4000-8000-000000000001",
  activeOrganizationId: "10000000-0000-4000-8000-000000000010",
  membershipStatus: "active",
  role: "teacher",
};
const classroom: ClassRosterClassReference = {
  classId: "10000000-0000-4000-8000-000000000020",
  organizationId: actor.activeOrganizationId,
  status: "active",
  teacherId: actor.accountId,
};

describe("LE-001 Phase 5A class roster access", () => {
  it.each(["organization_owner", "organization_admin"] as const)(
    "allows %s inside the active organization",
    (role) => {
      expect(
        decideClassRosterAccess({ actor: { ...actor, role }, classroom }),
      ).toEqual({ allowed: true, reason: "ALLOWED" });
    },
  );

  it("allows only the assigned Teacher of an active Class", () => {
    expect(decideClassRosterAccess({ actor, classroom })).toEqual({
      allowed: true,
      reason: "ALLOWED",
    });
    expect(
      decideClassRosterAccess({
        actor: {
          ...actor,
          accountId: "10000000-0000-4000-8000-000000000002",
        },
        classroom,
      }),
    ).toEqual({ allowed: false, reason: "TEACHER_NOT_ASSIGNED" });
    expect(
      decideClassRosterAccess({
        actor,
        classroom: { ...classroom, status: "archived" },
      }),
    ).toEqual({ allowed: false, reason: "TEACHER_CLASS_INACTIVE" });
  });

  it("fails closed for cross-tenant, inactive membership, and other roles", () => {
    expect(
      decideClassRosterAccess({
        actor,
        classroom: {
          ...classroom,
          organizationId: "10000000-0000-4000-8000-000000000099",
        },
      }),
    ).toEqual({
      allowed: false,
      reason: "CLASS_OUTSIDE_ACTIVE_ORGANIZATION",
    });
    expect(
      decideClassRosterAccess({
        actor: { ...actor, membershipStatus: "suspended" },
        classroom,
      }),
    ).toEqual({ allowed: false, reason: "MEMBERSHIP_INACTIVE" });
    expect(
      decideClassRosterAccess({
        actor: { ...actor, role: "reviewer" },
        classroom,
      }),
    ).toEqual({ allowed: false, reason: "ROLE_NOT_ALLOWED" });
  });

  it("returns immutable decisions", () => {
    expect(Object.isFrozen(decideClassRosterAccess({ actor, classroom }))).toBe(
      true,
    );
  });
});
