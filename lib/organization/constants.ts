export const ORGANIZATION_ROLES = [
  "organization_owner",
  "organization_admin",
  "teacher",
  "reviewer",
  "branch_manager",
  "student",
  "guardian",
] as const;

export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number];

export const ACTIVE_SPRINT_6_ROLES = [
  "organization_owner",
  "organization_admin",
  "teacher",
  "reviewer",
] as const satisfies readonly OrganizationRole[];

export const ORGANIZATION_ROLE_LABELS: Record<OrganizationRole, string> = {
  organization_owner: "機構擁有者",
  organization_admin: "機構管理員",
  teacher: "教師",
  reviewer: "教材審核者",
  branch_manager: "分校主管（尚未開放）",
  student: "學生（尚未開放）",
  guardian: "家長（尚未開放）",
};

export function getOrganizationRoleLabel(role: OrganizationRole): string {
  return ORGANIZATION_ROLE_LABELS[role];
}

export function canEditOrganization(role: OrganizationRole): boolean {
  return role === "organization_owner" || role === "organization_admin";
}

export function canManageCurriculums(role: OrganizationRole): boolean {
  return role === "organization_owner" || role === "organization_admin";
}

export const ORGANIZATION_RESERVED_SLUGS = [
  "admin",
  "api",
  "auth",
  "dashboard",
  "settings",
  "system",
  "support",
] as const;

export const ORGANIZATION_SLUG_MIN_LENGTH = 3;
export const ORGANIZATION_SLUG_MAX_LENGTH = 48;
