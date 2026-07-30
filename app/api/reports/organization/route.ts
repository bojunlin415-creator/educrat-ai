import { reportingErrorResponse, reportingSuccess } from "@/lib/reporting/api";
import { getOrganizationReport } from "@/lib/reporting/service";

export async function GET() {
  try {
    const report = await getOrganizationReport();
    return Response.json(reportingSuccess("機構報表已載入。", { report }));
  } catch (error: unknown) {
    return reportingErrorResponse(error);
  }
}
