import type { OrganizationRole } from "@/lib/organization/constants";

export interface AccessUser {
  readonly displayName: string | null;
  readonly email: string | null;
  readonly joinedAt: string | null;
  readonly membershipId: string;
  readonly role: OrganizationRole;
  readonly status: "active" | "invited" | "removed" | "suspended";
  readonly userId: string;
}

export interface AccessGuardianInvitation {
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly guardianEmail: string;
  readonly id: string;
  readonly relationshipType: string;
  readonly status: string;
  readonly studentId: string;
}

export interface AccessGuardianRelationship {
  readonly activatedAt: string | null;
  readonly consentGrantedAt: string | null;
  readonly guardianUserId: string;
  readonly id: string;
  readonly relationshipType: string;
  readonly revokedAt: string | null;
  readonly status: string;
  readonly studentId: string;
}

export interface AccessClassSummary {
  readonly classId: string;
  readonly name: string;
  readonly status: string;
  readonly studentCount: number;
  readonly teacherId: string;
}

export interface PermissionSummaryItem {
  readonly label: string;
  readonly value: string;
}

export interface AccessOverview {
  readonly classes: readonly AccessClassSummary[];
  readonly currentRole: OrganizationRole;
  readonly guardianInvitations: readonly AccessGuardianInvitation[];
  readonly guardianRelationships: readonly AccessGuardianRelationship[];
  readonly organizationId: string;
  readonly permissionSummary: readonly PermissionSummaryItem[];
  readonly users: readonly AccessUser[];
}

export function canOpenAccessControl(role: OrganizationRole): boolean {
  return role === "organization_owner" || role === "organization_admin";
}

export function canAssignRole(input: {
  readonly actorRole: OrganizationRole;
  readonly targetRole: OrganizationRole;
  readonly nextRole: OrganizationRole;
  readonly targetUserIsActor: boolean;
}): boolean {
  if (input.targetUserIsActor) return false;
  if (input.targetRole === "organization_owner") return false;
  if (input.nextRole === "organization_owner") return false;
  if (input.actorRole === "organization_owner") return true;
  return (
    input.actorRole === "organization_admin" &&
    input.nextRole !== "organization_admin"
  );
}

export function buildPermissionSummary(role: OrganizationRole) {
  const canManage = canOpenAccessControl(role);
  return Object.freeze([
    { label: "Access control", value: canManage ? "可管理" : "不可管理" },
    {
      label: "Owner protection",
      value: "最後一位 active owner 不可停用或移除",
    },
    {
      label: "Multi-role",
      value: "目前同機構仍採 legacy single-role；多角色需後續 migration",
    },
    {
      label: "Guardian boundary",
      value: "Guardian relationship 不等於 staff role",
    },
  ] satisfies PermissionSummaryItem[]);
}
