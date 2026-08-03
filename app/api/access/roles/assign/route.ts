import {
  accessControlErrorResponse,
  accessControlSuccess,
  parseAccessControlJson,
} from "@/lib/access-control/api";
import { assignAccessRole } from "@/lib/access-control/service";
import { assignAccessRoleSchema } from "@/lib/validation/access";

export async function POST(request: Request) {
  const parsed = await parseAccessControlJson(request, assignAccessRoleSchema);
  if (!parsed.success) return parsed.response;
  try {
    const membershipId = await assignAccessRole(parsed.data);
    return Response.json(
      accessControlSuccess("角色已更新。", { membershipId }),
    );
  } catch (error: unknown) {
    return accessControlErrorResponse(error);
  }
}
