import {
  parentPortalErrorResponse,
  parentPortalSuccess,
} from "@/lib/parent-portal/api";
import { getParentRecommendations } from "@/lib/parent-portal/service";

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly studentId: string }> },
) {
  try {
    const { studentId } = await params;
    const recommendations = await getParentRecommendations(studentId);
    return Response.json(
      parentPortalSuccess("孩子練習建議已載入。", { recommendations }),
    );
  } catch (error: unknown) {
    return parentPortalErrorResponse(error);
  }
}
