import "server-only";

import { resolveRoleHomeDestination } from "@/lib/onboarding/destination";
import { getCurrentOrganization } from "@/lib/organization/service";

export async function resolvePostLoginDestination() {
  try {
    const context = await getCurrentOrganization();
    return context
      ? resolveRoleHomeDestination(context.membership.role)
      : "/dashboard";
  } catch {
    return "/dashboard";
  }
}
