import "server-only";

import type { User } from "@supabase/supabase-js";
import {
  DefaultAuthorizationContextProvider,
  authorize,
  parsePermissionKey,
  parsePermissionExpression,
  type AuthorizationContextProvider,
  type AuthorizationPolicy,
  type DecisionResult,
  type PermissionGrant,
  type ResourceScope,
} from "@/lib/authorization";
import type { OrganizationContext } from "@/lib/organization/service";

const CURRICULUM_MANAGEMENT_PERMISSIONS = [
  "curriculum.archive",
  "curriculum.delete",
  "curriculum.restore",
  "curriculum.permanently_delete",
  "recycle_bin.read",
] as const;

const MANAGING_ROLES = new Set(["organization_owner", "organization_admin"]);

function organizationScope(organizationId: string): ResourceScope {
  return Object.freeze({ organizationId, type: "ORGANIZATION" });
}

function lifecyclePolicies(
  organizationId: string,
): readonly AuthorizationPolicy[] {
  return Object.freeze(
    CURRICULUM_MANAGEMENT_PERMISSIONS.map((permission, index) =>
      Object.freeze({
        description: "PI-001 curriculum lifecycle policy.",
        effect: "ALLOW",
        enabled: true,
        id: `pi001:${permission.replaceAll(".", ":")}`,
        permission: parsePermissionExpression(permission),
        priority: 100 - index,
        scope: organizationScope(organizationId),
      }),
    ),
  );
}

function createPermissionGrants(
  organizationId: string,
  role: string,
): readonly PermissionGrant[] {
  if (!MANAGING_ROLES.has(role)) return Object.freeze([]);

  return Object.freeze(
    CURRICULUM_MANAGEMENT_PERMISSIONS.map((permission) =>
      Object.freeze({
        organizationId,
        permission: parsePermissionKey(permission),
        scope: organizationScope(organizationId),
      }),
    ),
  );
}

export function createCurriculumAuthorizationProvider(
  context: OrganizationContext,
  user: User,
): AuthorizationContextProvider {
  const organizationId = context.organization.id;
  const identityId = user.id;
  const membership = context.membership;

  return new DefaultAuthorizationContextProvider({
    identityProvider: {
      async getIdentity() {
        return Object.freeze({
          id: identityId,
          personId: identityId,
          type: "ACCOUNT",
        });
      },
    },
    membershipProvider: {
      async getMemberships(identity) {
        return Object.freeze({
          activeOrganizationId: organizationId,
          identityId: identity.id,
          memberships: Object.freeze([
            Object.freeze({
              id: membership.id,
              organizationId,
              status: membership.status,
            }),
          ]),
        });
      },
    },
    permissionGrantProvider: {
      async getPermissionGrants(identity) {
        return Object.freeze({
          activeOrganizationId: organizationId,
          authority: Object.freeze({
            id: `membership:${membership.id}`,
            trusted: true,
            type: "ROLE_ASSIGNMENT",
            version: "pi001",
          }),
          grants: createPermissionGrants(organizationId, membership.role),
          identityId: identity.id,
        });
      },
    },
    personaProvider: {
      async getPersonas(identity) {
        return Object.freeze({
          activeOrganizationId: organizationId,
          identityId: identity.id,
          personas: Object.freeze([]),
        });
      },
    },
    roleProvider: {
      async getRoles(identity) {
        return Object.freeze({
          activeOrganizationId: organizationId,
          identityId: identity.id,
          roles: Object.freeze([
            Object.freeze({
              assignmentId: membership.id,
              key: membership.role,
              organizationId,
              status: membership.status,
              version: "legacy-organization-role",
            }),
          ]),
        });
      },
    },
  });
}

export async function authorizeCurriculumLifecycle(input: {
  readonly context: OrganizationContext;
  readonly curriculumId: string;
  readonly permission:
    | "curriculum.archive"
    | "curriculum.delete"
    | "curriculum.permanently_delete"
    | "curriculum.restore"
    | "recycle_bin.read";
  readonly user: User;
}): Promise<DecisionResult> {
  return authorize(
    {
      permission: parsePermissionKey(input.permission),
      policies: lifecyclePolicies(input.context.organization.id),
      resourceAttributes: {
        lineage: {
          CURRICULUM: input.curriculumId,
          ORGANIZATION: input.context.organization.id,
        },
      },
      scope: organizationScope(input.context.organization.id),
    },
    {
      contextProvider: createCurriculumAuthorizationProvider(
        input.context,
        input.user,
      ),
    },
  );
}

export function isAllowedDecision(decision: DecisionResult): boolean {
  return decision.decision === "ALLOW";
}
