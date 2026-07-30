import { reportingErrorResponse, reportingSuccess } from "@/lib/reporting/api";
import { getReportExportOptions } from "@/lib/reporting/service";

export async function GET() {
  try {
    const exportOptions = await getReportExportOptions();
    return Response.json(
      reportingSuccess("報表匯出選項已載入。", { exportOptions }),
    );
  } catch (error: unknown) {
    return reportingErrorResponse(error);
  }
}
