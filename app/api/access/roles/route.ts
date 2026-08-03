import {
  accessControlErrorResponse,
  accessControlSuccess,
} from "@/lib/access-control/api";
import { getAccessOverview } from "@/lib/access-control/service";

export async function GET() {
  try {
    const overview = await getAccessOverview();
    return Response.json(
      accessControlSuccess("角色摘要已載入。", {
        permissionSummary: overview.permissionSummary,
        users: overview.users,
      }),
    );
  } catch (error: unknown) {
    return accessControlErrorResponse(error);
  }
}
