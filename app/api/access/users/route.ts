import {
  accessControlErrorResponse,
  accessControlSuccess,
} from "@/lib/access-control/api";
import { getAccessOverview } from "@/lib/access-control/service";

export async function GET() {
  try {
    const overview = await getAccessOverview();
    return Response.json(
      accessControlSuccess("使用者與權限已載入。", {
        users: overview.users,
      }),
    );
  } catch (error: unknown) {
    return accessControlErrorResponse(error);
  }
}
