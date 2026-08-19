import {
  parseReportingQuery,
  reportingErrorResponse,
  reportingSuccess,
} from "@/lib/reporting/api";
import { getTeacherReport } from "@/lib/reporting/service";
import { observeLearnerShadowConsumer } from "@/lib/learner-convergence/server";
import { teacherReportQuerySchema } from "@/lib/validation/reporting";

export async function GET(request: Request) {
  const parsed = parseReportingQuery(request.url, teacherReportQuerySchema);
  if (!parsed.success) return parsed.response;

  try {
    const report = await getTeacherReport(parsed.data);
    await observeLearnerShadowConsumer({
      consumer: "reporting",
      scope: {
        classIds: [parsed.data.classId],
        legacyAccountIds: Array.isArray(report.studentRanking)
          ? report.studentRanking.map((row) => row.studentId)
          : undefined,
      },
    });
    return Response.json(reportingSuccess("教師報表已載入。", { report }));
  } catch (error: unknown) {
    return reportingErrorResponse(error);
  }
}
