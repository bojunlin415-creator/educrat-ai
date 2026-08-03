import {
  parentPortalErrorResponse,
  parentPortalSuccess,
  parseParentPortalQuery,
} from "@/lib/parent-portal/api";
import { getParentDashboard } from "@/lib/parent-portal/service";
import { parentDashboardQuerySchema } from "@/lib/validation/parent-portal";

export async function GET(request: Request) {
  const parsed = parseParentPortalQuery(
    request.url,
    parentDashboardQuerySchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const dashboard = await getParentDashboard(parsed.data);
    return Response.json(
      parentPortalSuccess("家長入口已載入。", { dashboard }),
    );
  } catch (error: unknown) {
    return parentPortalErrorResponse(error);
  }
}
