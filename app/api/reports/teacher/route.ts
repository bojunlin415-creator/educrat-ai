import {
  parseReportingQuery,
  reportingErrorResponse,
  reportingSuccess,
} from "@/lib/reporting/api";
import { getTeacherReport } from "@/lib/reporting/service";
import { teacherReportQuerySchema } from "@/lib/validation/reporting";

export async function GET(request: Request) {
  const parsed = parseReportingQuery(request.url, teacherReportQuerySchema);
  if (!parsed.success) return parsed.response;

  try {
    const report = await getTeacherReport(parsed.data);
    return Response.json(reportingSuccess("教師報表已載入。", { report }));
  } catch (error: unknown) {
    return reportingErrorResponse(error);
  }
}
