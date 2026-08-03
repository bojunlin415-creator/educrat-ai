import {
  accessControlErrorResponse,
  accessControlSuccess,
  parseAccessControlJson,
} from "@/lib/access-control/api";
import { switchRoleContext } from "@/lib/access-control/service";
import { resolveRoleHomeDestination } from "@/lib/onboarding/destination";
import { roleContextSwitchSchema } from "@/lib/validation/access";

export async function POST(request: Request) {
  const parsed = await parseAccessControlJson(request, roleContextSwitchSchema);
  if (!parsed.success) return parsed.response;
  try {
    const context = await switchRoleContext(parsed.data);
    return Response.json(
      accessControlSuccess("工作區已切換。", {
        organization: {
          id: context.organization.id,
          name: context.organization.name,
          role: context.membership.role,
        },
        redirectTo: resolveRoleHomeDestination(context.membership.role),
      }),
    );
  } catch (error: unknown) {
    return accessControlErrorResponse(error);
  }
}
