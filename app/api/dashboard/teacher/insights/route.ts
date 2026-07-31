import {
  parseTeacherDashboardQuery,
  teacherDashboardErrorResponse,
  teacherDashboardSuccess,
} from "@/lib/teacher-dashboard/api";
import { getTeacherDashboardInsights } from "@/lib/teacher-dashboard/service";
import { teacherDashboardQuerySchema } from "@/lib/validation/teacher-dashboard";

export async function GET(request: Request) {
  const parsed = parseTeacherDashboardQuery(
    request.url,
    teacherDashboardQuerySchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const insights = await getTeacherDashboardInsights(parsed.data);
    return Response.json(
      teacherDashboardSuccess("教學洞察已載入。", { insights }),
    );
  } catch (error: unknown) {
    return teacherDashboardErrorResponse(error);
  }
}
