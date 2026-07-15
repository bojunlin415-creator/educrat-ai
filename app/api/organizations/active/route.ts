import {
  organizationErrorResponse,
  organizationSuccess,
  parseOrganizationJson,
} from "@/lib/organization/api";
import { switchActiveOrganization } from "@/lib/organization/service";
import { switchOrganizationSchema } from "@/lib/validation/organization";

export async function PUT(request: Request) {
  const parsed = await parseOrganizationJson(request, switchOrganizationSchema);
  if (!parsed.success) return parsed.response;

  try {
    const context = await switchActiveOrganization(parsed.data);
    return Response.json(
      organizationSuccess("目前機構已切換。", {
        organization: {
          id: context.organization.id,
          name: context.organization.name,
          role: context.membership.role,
          slug: context.organization.slug,
        },
      }),
    );
  } catch (error: unknown) {
    return organizationErrorResponse(error);
  }
}
