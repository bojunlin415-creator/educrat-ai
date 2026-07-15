import "server-only";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import {
  getCurrentOrganization,
  listUserOrganizations,
} from "@/lib/organization/service";
import { getOwnProfile } from "@/lib/profile/service";

export async function requireWorkspaceContext() {
  const user = await requireUser();
  const profile = await getOwnProfile(user.id);
  if (!profile?.onboarding_completed) redirect("/onboarding");

  const currentOrganization = await getCurrentOrganization();
  if (!currentOrganization) redirect("/onboarding/organization");

  return { currentOrganization, profile, user };
}

export async function requireDashboardContext() {
  const context = await requireWorkspaceContext();
  const organizations = await listUserOrganizations();
  return { ...context, organizations };
}
