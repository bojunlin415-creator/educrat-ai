import {
  parentPortalErrorResponse,
  parentPortalSuccess,
} from "@/lib/parent-portal/api";
import { getParentAssignmentSummary } from "@/lib/parent-portal/service";

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly studentId: string }> },
) {
  try {
    const { studentId } = await params;
    const assignments = await getParentAssignmentSummary(studentId);
    return Response.json(
      parentPortalSuccess("孩子作業摘要已載入。", { assignments }),
    );
  } catch (error: unknown) {
    return parentPortalErrorResponse(error);
  }
}
