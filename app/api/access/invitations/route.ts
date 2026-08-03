import {
  accessControlErrorResponse,
  accessControlSuccess,
} from "@/lib/access-control/api";
import { getAccessOverview } from "@/lib/access-control/service";

export async function GET() {
  try {
    const overview = await getAccessOverview();
    return Response.json(
      accessControlSuccess("家長邀請已載入。", {
        invitations: overview.guardianInvitations,
      }),
    );
  } catch (error: unknown) {
    return accessControlErrorResponse(error);
  }
}
