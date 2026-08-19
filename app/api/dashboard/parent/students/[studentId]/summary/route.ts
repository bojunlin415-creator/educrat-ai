import {
  parentPortalErrorResponse,
  parentPortalSuccess,
} from "@/lib/parent-portal/api";
import { getParentStudentReport } from "@/lib/parent-portal/service";
import { observeLearnerShadowConsumer } from "@/lib/learner-convergence/server";

export async function GET(
  _request: Request,
  { params }: { readonly params: Promise<{ readonly studentId: string }> },
) {
  try {
    const { studentId } = await params;
    const report = await getParentStudentReport(studentId);
    await observeLearnerShadowConsumer({
      consumer: "guardian_parent_portal",
      scope: { legacyAccountIds: [report.child.studentId] },
    });
    return Response.json(
      parentPortalSuccess("孩子學習摘要已載入。", { report }),
    );
  } catch (error: unknown) {
    return parentPortalErrorResponse(error);
  }
}
