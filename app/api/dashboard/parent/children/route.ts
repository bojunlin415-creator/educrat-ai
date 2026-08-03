import {
  parentPortalErrorResponse,
  parentPortalSuccess,
} from "@/lib/parent-portal/api";
import { listParentChildren } from "@/lib/parent-portal/service";

export async function GET() {
  try {
    const children = await listParentChildren();
    return Response.json(
      parentPortalSuccess("可查看的孩子已載入。", { children }),
    );
  } catch (error: unknown) {
    return parentPortalErrorResponse(error);
  }
}
