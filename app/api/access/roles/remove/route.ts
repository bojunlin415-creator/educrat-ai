import {
  accessControlErrorResponse,
  accessControlSuccess,
  parseAccessControlJson,
} from "@/lib/access-control/api";
import { removeAccessRole } from "@/lib/access-control/service";
import { removeAccessRoleSchema } from "@/lib/validation/access";

export async function POST(request: Request) {
  const parsed = await parseAccessControlJson(request, removeAccessRoleSchema);
  if (!parsed.success) return parsed.response;
  try {
    const membershipId = await removeAccessRole(parsed.data);
    return Response.json(
      accessControlSuccess("成員角色已移除。", { membershipId }),
    );
  } catch (error: unknown) {
    return accessControlErrorResponse(error);
  }
}
