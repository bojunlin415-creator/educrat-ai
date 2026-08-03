import "server-only";

import type { User } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { AccessControlError } from "@/lib/access-control/errors";
import {
  buildPermissionSummary,
  type AccessClassSummary,
  type AccessGuardianInvitation,
  type AccessGuardianRelationship,
  type AccessOverview,
  type AccessUser,
} from "@/lib/access-control/domain";
import { getCurrentUser } from "@/lib/auth/session";
import { GuardianVerificationError } from "@/lib/guardian-verification/errors";
import { revokeGuardianRelationship } from "@/lib/guardian-verification/service";
import { OrganizationError } from "@/lib/organization/errors";
import {
  requireOrganizationMembership,
  requireOrganizationRole,
} from "@/lib/organization/service";
import { createClient } from "@/lib/supabase/server";
import {
  assignAccessRoleSchema,
  memberStatusChangeSchema,
  removeAccessRoleSchema,
  revokeAccessGuardianRelationshipSchema,
  roleContextSwitchSchema,
  type AssignAccessRoleInput,
  type MemberStatusChangeInput,
  type RemoveAccessRoleInput,
  type RevokeAccessGuardianRelationshipInput,
  type RoleContextSwitchInput,
} from "@/lib/validation/access";

type MembershipRow =
  Database["public"]["Tables"]["organization_members"]["Row"];
type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type ClassEnrollmentRow =
  Database["public"]["Tables"]["class_enrollments"]["Row"];
type GuardianInvitationRow =
  Database["public"]["Tables"]["guardian_invitations"]["Row"];
type GuardianRelationshipRow =
  Database["public"]["Tables"]["student_guardians"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return new AccessControlError("service_unavailable");
  if (error.message?.includes("organization_requires_active_owner")) {
    return new AccessControlError("last_owner");
  }
  if (
    error.message?.includes("self_elevation_forbidden") ||
    error.message?.includes("self_mutation_forbidden")
  ) {
    return new AccessControlError("forbidden");
  }
  if (
    error.message?.includes("admin_cannot") ||
    error.message?.includes("owner_role_protected")
  ) {
    return new AccessControlError("forbidden");
  }
  if (error.message?.includes("invalid_access") || error.code === "22023") {
    return new AccessControlError("invalid_input");
  }
  if (error.code === "P0002") return new AccessControlError("not_found");
  if (error.code === "42501") {
    if (error.message?.includes("authentication_required")) {
      return new AccessControlError("not_authenticated");
    }
    return new AccessControlError("forbidden");
  }
  return new AccessControlError("service_unavailable");
}

function mapOrganizationError(error: OrganizationError): AccessControlError {
  switch (error.code) {
    case "not_authenticated":
      return new AccessControlError("not_authenticated");
    case "organization_not_found":
    case "not_member":
      return new AccessControlError("organization_required");
    case "forbidden":
      return new AccessControlError("forbidden");
    default:
      return new AccessControlError("service_unavailable");
  }
}

function mapGuardianError(
  error: GuardianVerificationError,
): AccessControlError {
  switch (error.code) {
    case "not_authenticated":
      return new AccessControlError("not_authenticated");
    case "not_found":
      return new AccessControlError("not_found");
    case "invalid_input":
      return new AccessControlError("invalid_input");
    case "organization_required":
      return new AccessControlError("organization_required");
    case "forbidden":
    case "role_conflict":
      return new AccessControlError("forbidden");
    default:
      return new AccessControlError("service_unavailable");
  }
}

async function requireAccessManager() {
  try {
    return await requireOrganizationRole([
      "organization_owner",
      "organization_admin",
    ]);
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

async function requireActor(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AccessControlError("not_authenticated");
  return user;
}

async function writeAccessAudit(input: {
  readonly action: "ACCESS_SETTINGS_VIEWED" | "ROLE_CONTEXT_SWITCHED";
  readonly actorId: string;
  readonly metadata?: Json;
  readonly organizationId: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("write_access_control_audit", {
    p_action: input.action,
    p_actor_id: input.actorId,
    p_metadata: input.metadata ?? {},
    p_organization_id: input.organizationId,
    p_target_membership_id: null,
  });
  if (error) throw mapDatabaseError(error);
}

function profileName(
  profileById: ReadonlyMap<string, Pick<ProfileRow, "display_name" | "id">>,
  userId: string,
) {
  return profileById.get(userId)?.display_name ?? null;
}

function buildUsers(
  memberships: readonly MembershipRow[],
  profiles: readonly Pick<ProfileRow, "display_name" | "id">[],
): readonly AccessUser[] {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  return Object.freeze(
    memberships.map((membership) =>
      Object.freeze({
        displayName: profileName(profileById, membership.user_id),
        email: null,
        joinedAt: membership.joined_at,
        membershipId: membership.id,
        role: membership.role,
        status: membership.status,
        userId: membership.user_id,
      }),
    ),
  );
}

function buildClasses(
  classes: readonly ClassRow[],
  enrollments: readonly ClassEnrollmentRow[],
): readonly AccessClassSummary[] {
  return Object.freeze(
    classes.map((classroom) =>
      Object.freeze({
        classId: classroom.id,
        name: classroom.name,
        status: classroom.status,
        studentCount: enrollments.filter(
          (enrollment) =>
            enrollment.class_id === classroom.id &&
            enrollment.status === "active",
        ).length,
        teacherId: classroom.teacher_id,
      }),
    ),
  );
}

function buildInvitations(
  invitations: readonly GuardianInvitationRow[],
): readonly AccessGuardianInvitation[] {
  return Object.freeze(
    invitations.map((invitation) =>
      Object.freeze({
        createdAt: invitation.created_at,
        expiresAt: invitation.expires_at,
        guardianEmail: invitation.guardian_email_normalized,
        id: invitation.id,
        relationshipType: invitation.relationship_type,
        status: invitation.status,
        studentId: invitation.student_id,
      }),
    ),
  );
}

function buildRelationships(
  relationships: readonly GuardianRelationshipRow[],
): readonly AccessGuardianRelationship[] {
  return Object.freeze(
    relationships.map((relationship) =>
      Object.freeze({
        activatedAt: relationship.activated_at,
        consentGrantedAt: relationship.consent_granted_at,
        guardianUserId: relationship.guardian_user_id,
        id: relationship.id,
        relationshipType: relationship.relationship_type,
        revokedAt: relationship.revoked_at,
        status: relationship.status,
        studentId: relationship.student_id,
      }),
    ),
  );
}

export async function getAccessOverview(): Promise<AccessOverview> {
  const context = await requireAccessManager();
  const actor = await requireActor();
  const supabase = await createClient();
  const [
    membershipsResult,
    classesResult,
    enrollmentsResult,
    invitationsResult,
    relationshipsResult,
  ] = await Promise.all([
    supabase
      .from("organization_members")
      .select("*")
      .eq("organization_id", context.organization.id)
      .order("created_at", { ascending: true }),
    supabase
      .from("classes")
      .select("*")
      .eq("organization_id", context.organization.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("class_enrollments")
      .select("*")
      .eq("organization_id", context.organization.id),
    supabase
      .from("guardian_invitations")
      .select("*")
      .eq("organization_id", context.organization.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("student_guardians")
      .select("*")
      .eq("organization_id", context.organization.id)
      .order("created_at", { ascending: false }),
  ]);
  if (membershipsResult.error) throw mapDatabaseError(membershipsResult.error);
  if (classesResult.error) throw mapDatabaseError(classesResult.error);
  if (enrollmentsResult.error) throw mapDatabaseError(enrollmentsResult.error);
  if (invitationsResult.error) throw mapDatabaseError(invitationsResult.error);
  if (relationshipsResult.error)
    throw mapDatabaseError(relationshipsResult.error);

  const userIds = membershipsResult.data.map(
    (membership) => membership.user_id,
  );
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id,display_name")
    .in("id", userIds);
  if (profileError) throw mapDatabaseError(profileError);

  await writeAccessAudit({
    action: "ACCESS_SETTINGS_VIEWED",
    actorId: actor.id,
    metadata: { userCount: membershipsResult.data.length },
    organizationId: context.organization.id,
  });

  return Object.freeze({
    classes: buildClasses(classesResult.data, enrollmentsResult.data),
    currentRole: context.membership.role,
    guardianInvitations: buildInvitations(invitationsResult.data),
    guardianRelationships: buildRelationships(relationshipsResult.data),
    organizationId: context.organization.id,
    permissionSummary: buildPermissionSummary(context.membership.role),
    users: buildUsers(membershipsResult.data, profiles),
  });
}

export async function assignAccessRole(input: AssignAccessRoleInput) {
  const parsed = assignAccessRoleSchema.safeParse(input);
  if (!parsed.success) throw new AccessControlError("invalid_input");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "assign_organization_member_role",
    {
      p_membership_id: parsed.data.membershipId,
      p_reason: parsed.data.reason,
      p_role: parsed.data.role,
    },
  );
  if (error) throw mapDatabaseError(error);
  if (!data) throw new AccessControlError("service_unavailable");
  return data;
}

export async function removeAccessRole(input: RemoveAccessRoleInput) {
  const parsed = removeAccessRoleSchema.safeParse(input);
  if (!parsed.success) throw new AccessControlError("invalid_input");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "remove_organization_member_role",
    {
      p_membership_id: parsed.data.membershipId,
      p_reason: parsed.data.reason,
    },
  );
  if (error) throw mapDatabaseError(error);
  if (!data) throw new AccessControlError("service_unavailable");
  return data;
}

export async function disableAccessMember(input: MemberStatusChangeInput) {
  const parsed = memberStatusChangeSchema.safeParse(input);
  if (!parsed.success) throw new AccessControlError("invalid_input");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "set_organization_member_access_status",
    {
      p_membership_id: parsed.data.membershipId,
      p_reason: parsed.data.reason,
      p_status: "suspended",
    },
  );
  if (error) throw mapDatabaseError(error);
  if (!data) throw new AccessControlError("service_unavailable");
  return data;
}

export async function enableAccessMember(input: MemberStatusChangeInput) {
  const parsed = memberStatusChangeSchema.safeParse(input);
  if (!parsed.success) throw new AccessControlError("invalid_input");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "set_organization_member_access_status",
    {
      p_membership_id: parsed.data.membershipId,
      p_reason: parsed.data.reason,
      p_status: "active",
    },
  );
  if (error) throw mapDatabaseError(error);
  if (!data) throw new AccessControlError("service_unavailable");
  return data;
}

export async function revokeAccessGuardianRelationship(
  relationshipId: string,
  input: RevokeAccessGuardianRelationshipInput,
) {
  const parsed = revokeAccessGuardianRelationshipSchema.safeParse(input);
  if (!parsed.success) throw new AccessControlError("invalid_input");
  try {
    return await revokeGuardianRelationship({
      reason: parsed.data.reason,
      relationshipId,
    });
  } catch (error: unknown) {
    if (error instanceof GuardianVerificationError)
      throw mapGuardianError(error);
    throw error;
  }
}

export async function switchRoleContext(input: RoleContextSwitchInput) {
  const parsed = roleContextSwitchSchema.safeParse(input);
  if (!parsed.success) throw new AccessControlError("invalid_input");
  const actor = await requireActor();
  let context;
  try {
    context = await requireOrganizationMembership(parsed.data.organizationId);
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
  if (
    context.membership.status !== "active" ||
    context.membership.role !== parsed.data.role
  ) {
    throw new AccessControlError("forbidden");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("switch_active_organization", {
    p_organization_id: context.organization.id,
  });
  if (error) throw mapDatabaseError(error);
  await writeAccessAudit({
    action: "ROLE_CONTEXT_SWITCHED",
    actorId: actor.id,
    metadata: { role: parsed.data.role },
    organizationId: context.organization.id,
  });
  return context;
}
