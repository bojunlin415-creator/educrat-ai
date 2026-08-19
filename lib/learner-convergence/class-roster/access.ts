import type {
  ClassRosterAccessDecision,
  ClassRosterActorContext,
  ClassRosterClassReference,
} from "@/lib/learner-convergence/class-roster/domain";

function decision(value: ClassRosterAccessDecision): ClassRosterAccessDecision {
  return Object.freeze(value);
}

export function decideClassRosterAccess(input: {
  readonly actor: ClassRosterActorContext;
  readonly classroom: ClassRosterClassReference;
}): ClassRosterAccessDecision {
  if (input.actor.membershipStatus !== "active") {
    return decision({ allowed: false, reason: "MEMBERSHIP_INACTIVE" });
  }
  if (input.classroom.organizationId !== input.actor.activeOrganizationId) {
    return decision({
      allowed: false,
      reason: "CLASS_OUTSIDE_ACTIVE_ORGANIZATION",
    });
  }
  if (
    input.actor.role === "organization_owner" ||
    input.actor.role === "organization_admin"
  ) {
    return decision({ allowed: true, reason: "ALLOWED" });
  }
  if (input.actor.role !== "teacher") {
    return decision({ allowed: false, reason: "ROLE_NOT_ALLOWED" });
  }
  if (input.classroom.teacherId !== input.actor.accountId) {
    return decision({ allowed: false, reason: "TEACHER_NOT_ASSIGNED" });
  }
  if (input.classroom.status !== "active") {
    return decision({ allowed: false, reason: "TEACHER_CLASS_INACTIVE" });
  }
  return decision({ allowed: true, reason: "ALLOWED" });
}
