import {
  organizationErrorResponse,
  organizationSuccess,
  parseOrganizationJson,
} from "@/lib/organization/api";
import { updateOrganization } from "@/lib/organization/service";
import { updateOrganizationSchema } from "@/lib/validation/organization";

export async function PUT(request: Request) {
  const parsed = await parseOrganizationJson(request, updateOrganizationSchema);
  if (!parsed.success) return parsed.response;

  try {
    const context = await updateOrganization(parsed.data);
    return Response.json(
      organizationSuccess("機構資料已儲存。", {
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
