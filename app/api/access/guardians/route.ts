import {
  accessControlErrorResponse,
  accessControlSuccess,
} from "@/lib/access-control/api";
import { getAccessOverview } from "@/lib/access-control/service";

export async function GET() {
  try {
    const overview = await getAccessOverview();
    return Response.json(
      accessControlSuccess("家長關係已載入。", {
        relationships: overview.guardianRelationships,
      }),
    );
  } catch (error: unknown) {
    return accessControlErrorResponse(error);
  }
}
