import {
  parseReportingQuery,
  reportingErrorResponse,
  reportingSuccess,
} from "@/lib/reporting/api";
import { getStudentReport } from "@/lib/reporting/service";
import { observeLearnerShadowConsumer } from "@/lib/learner-convergence/server";
import { studentReportQuerySchema } from "@/lib/validation/reporting";

export async function GET(request: Request) {
  const parsed = parseReportingQuery(request.url, studentReportQuerySchema);
  if (!parsed.success) return parsed.response;

  try {
    const report = await getStudentReport(parsed.data);
    await observeLearnerShadowConsumer({
      consumer: "reporting",
      scope: {
        legacyAccountIds: parsed.data.studentId
          ? [parsed.data.studentId]
          : [report.studentId],
      },
    });
    return Response.json(reportingSuccess("學生報表已載入。", { report }));
  } catch (error: unknown) {
    return reportingErrorResponse(error);
  }
}
