import {
  organizationErrorResponse,
  organizationSuccess,
  parseOrganizationJson,
} from "@/lib/organization/api";
import { createOrganization } from "@/lib/organization/service";
import { createOrganizationSchema } from "@/lib/validation/organization";

export async function POST(request: Request) {
  const parsed = await parseOrganizationJson(request, createOrganizationSchema);
  if (!parsed.success) return parsed.response;

  try {
    const context = await createOrganization(parsed.data);
    return Response.json(
      organizationSuccess("機構已建立，正在前往工作台。", {
        organization: {
          id: context.organization.id,
          name: context.organization.name,
          role: context.membership.role,
          slug: context.organization.slug,
        },
        redirectTo: "/dashboard",
      }),
      { status: 201 },
    );
  } catch (error: unknown) {
    return organizationErrorResponse(error);
  }
}
