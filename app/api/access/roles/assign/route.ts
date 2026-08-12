import {
  accessControlErrorResponse,
  accessControlSuccess,
  logAccessApi,
  parseAccessControlJson,
} from "@/lib/access-control/api";
import { assignAccessRole } from "@/lib/access-control/service";
import { assignAccessRoleSchema } from "@/lib/validation/access";

const route = "/api/access/roles/assign";

export async function POST(request: Request) {
  const parsed = await parseAccessControlJson(request, assignAccessRoleSchema);
  if (!parsed.success) {
    logAccessApi({
      payload: parsed.body,
      response: { status: parsed.responseStatus },
      route,
      service: null,
      validation: {
        errors: parsed.validationErrors,
        source: parsed.failureSource,
        success: false,
      },
    });
    return parsed.response;
  }
  try {
    const serviceInput = parsed.data;
    const membershipId = await assignAccessRole(serviceInput);
    logAccessApi({
      payload: parsed.body,
      response: { membershipId, status: 200 },
      route,
      service: { input: serviceInput, output: { membershipId } },
      validation: { payload: parsed.data, success: true },
    });
    return Response.json(
      accessControlSuccess("角色已更新。", { membershipId }),
    );
  } catch (error: unknown) {
    const response = accessControlErrorResponse(error);
    logAccessApi({
      payload: parsed.body,
      response: { status: response.status },
      route,
      service: { exception: error instanceof Error ? error.message : error },
      validation: { payload: parsed.data, success: true },
    });
    return response;
  }
}
