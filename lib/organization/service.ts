import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import {
  ACTIVE_SPRINT_6_ROLES,
  type OrganizationRole,
} from "@/lib/organization/constants";
import { OrganizationError } from "@/lib/organization/errors";
import { getOwnProfile } from "@/lib/profile/service";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  createOrganizationSchema,
  switchOrganizationSchema,
  updateOrganizationSchema,
  type CreateOrganizationInput,
  type SwitchOrganizationInput,
  type UpdateOrganizationInput,
} from "@/lib/validation/organization";

export type Organization = Database["public"]["Tables"]["organizations"]["Row"];
export type OrganizationMembership =
  Database["public"]["Tables"]["organization_members"]["Row"];

export interface OrganizationContext {
  membership: OrganizationMembership;
  organization: Organization;
}

function isSprint6Role(role: string): role is OrganizationRole {
  return ACTIVE_SPRINT_6_ROLES.some((allowedRole) => allowedRole === role);
}

async function requireAuthenticatedUser() {
  const user = await getCurrentUser();
  if (!user) throw new OrganizationError("not_authenticated");
  return user;
}

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return new OrganizationError("service_unavailable");
  if (
    error.code === "23505" ||
    error.message?.includes("organization_slug_taken")
  ) {
    return new OrganizationError("slug_taken");
  }
  if (error.code === "22023") {
    return new OrganizationError("invalid_input");
  }
  if (
    error.code === "42501" &&
    error.message?.includes("invalid_organization_membership")
  ) {
    return new OrganizationError("not_member");
  }
  if (
    error.code === "42501" &&
    error.message?.includes("profile_not_completed")
  ) {
    return new OrganizationError("profile_not_completed");
  }
  if (error.code === "42501") return new OrganizationError("forbidden");
  return new OrganizationError("service_unavailable");
}

export async function listUserOrganizations(): Promise<OrganizationContext[]> {
  const user = await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data: memberships, error: membershipError } = await supabase
    .from("organization_members")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (membershipError) throw mapDatabaseError(membershipError);
  if (memberships.length === 0) return [];

  const organizationIds = memberships.map(
    (membership) => membership.organization_id,
  );
  const { data: organizations, error: organizationError } = await supabase
    .from("organizations")
    .select("*")
    .in("id", organizationIds)
    .eq("status", "active")
    .is("deleted_at", null);

  if (organizationError) throw mapDatabaseError(organizationError);
  const organizationsById = new Map(
    organizations.map((organization) => [organization.id, organization]),
  );

  return memberships.flatMap((membership) => {
    const organization = organizationsById.get(membership.organization_id);
    return organization ? [{ membership, organization }] : [];
  });
}

export async function getCurrentOrganization(): Promise<OrganizationContext | null> {
  await requireAuthenticatedUser();
  const supabase = await createClient();
  const { data: activeOrganizationId, error } = await supabase.rpc(
    "get_active_organization_id",
  );

  if (error) throw mapDatabaseError(error);
  if (!activeOrganizationId) return null;

  const organizations = await listUserOrganizations();
  return (
    organizations.find(
      ({ organization }) => organization.id === activeOrganizationId,
    ) ?? null
  );
}

export async function getCurrentOrganizationMembership(): Promise<OrganizationMembership | null> {
  return (await getCurrentOrganization())?.membership ?? null;
}

export async function hasAnyOrganization(): Promise<boolean> {
  return (await listUserOrganizations()).length > 0;
}

export async function createOrganization(
  input: CreateOrganizationInput,
): Promise<OrganizationContext> {
  const parsed = createOrganizationSchema.safeParse(input);
  if (!parsed.success) throw new OrganizationError("invalid_input");

  const user = await requireAuthenticatedUser();
  const profile = await getOwnProfile(user.id);
  if (!profile?.onboarding_completed) {
    throw new OrganizationError("profile_not_completed");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization_with_owner", {
    p_address: parsed.data.address || null,
    p_business_name: parsed.data.businessName || null,
    p_email: parsed.data.email || null,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone || null,
    p_slug: parsed.data.slug,
  });

  if (error) throw mapDatabaseError(error);
  const context = await getCurrentOrganization();
  if (!context) throw new OrganizationError("service_unavailable");
  return context;
}

export async function requireOrganizationMembership(
  organizationId?: string,
): Promise<OrganizationContext> {
  if (!organizationId) {
    const current = await getCurrentOrganization();
    if (!current) throw new OrganizationError("organization_not_found");
    return current;
  }

  const parsed = switchOrganizationSchema.safeParse({ organizationId });
  if (!parsed.success) throw new OrganizationError("organization_not_found");
  const organizations = await listUserOrganizations();
  const context = organizations.find(
    ({ organization }) => organization.id === parsed.data.organizationId,
  );
  if (!context) throw new OrganizationError("not_member");
  return context;
}

export async function requireOrganizationRole(
  roles: readonly OrganizationRole[],
  organizationId?: string,
): Promise<OrganizationContext> {
  const context = await requireOrganizationMembership(organizationId);
  if (
    !isSprint6Role(context.membership.role) ||
    !roles.some((role) => role === context.membership.role)
  ) {
    throw new OrganizationError("forbidden");
  }
  return context;
}

export async function updateOrganization(
  input: UpdateOrganizationInput,
): Promise<OrganizationContext> {
  const parsed = updateOrganizationSchema.safeParse(input);
  if (!parsed.success) throw new OrganizationError("invalid_input");
  const context = await requireOrganizationRole([
    "organization_owner",
    "organization_admin",
  ]);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .update({
      address: parsed.data.address || null,
      business_name: parsed.data.businessName || null,
      email: parsed.data.email || null,
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      tax_id: parsed.data.taxId || null,
    })
    .eq("id", context.organization.id)
    .select("*")
    .single();

  if (error) throw mapDatabaseError(error);
  return { membership: context.membership, organization: data };
}

export async function switchActiveOrganization(
  input: SwitchOrganizationInput,
): Promise<OrganizationContext> {
  const parsed = switchOrganizationSchema.safeParse(input);
  if (!parsed.success) throw new OrganizationError("invalid_input");
  await requireAuthenticatedUser();

  const supabase = await createClient();
  const { error } = await supabase.rpc("switch_active_organization", {
    p_organization_id: parsed.data.organizationId,
  });
  if (error) throw mapDatabaseError(error);

  const context = await getCurrentOrganization();
  if (!context || context.organization.id !== parsed.data.organizationId) {
    throw new OrganizationError("service_unavailable");
  }
  return context;
}
