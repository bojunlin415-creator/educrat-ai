import { z } from "zod";
import { ORGANIZATION_ROLES } from "@/lib/organization/constants";

export const manageableOrganizationRoleSchema = z.enum([
  "organization_admin",
  "teacher",
  "reviewer",
]);

export const accessMembershipIdSchema = z.uuid();
export const accessRelationshipIdSchema = z.uuid();

export const assignAccessRoleSchema = z.object({
  membershipId: accessMembershipIdSchema,
  role: manageableOrganizationRoleSchema,
  reason: z.string().trim().min(4).max(300),
});

export const removeAccessRoleSchema = z.object({
  membershipId: accessMembershipIdSchema,
  reason: z.string().trim().min(4).max(300),
});

export const memberStatusChangeSchema = z.object({
  membershipId: accessMembershipIdSchema,
  reason: z.string().trim().min(4).max(300),
});

export const revokeAccessGuardianRelationshipSchema = z.object({
  reason: z.string().trim().min(4).max(300),
});

export const roleContextSwitchSchema = z.object({
  organizationId: z.uuid(),
  role: z.enum(ORGANIZATION_ROLES),
});

export type AssignAccessRoleInput = z.infer<typeof assignAccessRoleSchema>;
export type ManageableOrganizationRole = z.infer<
  typeof manageableOrganizationRoleSchema
>;
export type RemoveAccessRoleInput = z.infer<typeof removeAccessRoleSchema>;
export type MemberStatusChangeInput = z.infer<typeof memberStatusChangeSchema>;
export type RevokeAccessGuardianRelationshipInput = z.infer<
  typeof revokeAccessGuardianRelationshipSchema
>;
export type RoleContextSwitchInput = z.infer<typeof roleContextSwitchSchema>;
