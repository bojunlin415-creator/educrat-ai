import {
  parseTeacherDashboardQuery,
  teacherDashboardErrorResponse,
  teacherDashboardSuccess,
} from "@/lib/teacher-dashboard/api";
import { getTeacherDashboard } from "@/lib/teacher-dashboard/service";
import { teacherDashboardQuerySchema } from "@/lib/validation/teacher-dashboard";

export async function GET(request: Request) {
  const parsed = parseTeacherDashboardQuery(
    request.url,
    teacherDashboardQuerySchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const dashboard = await getTeacherDashboard(parsed.data);
    return Response.json(
      teacherDashboardSuccess("教師儀表板已載入。", { dashboard }),
    );
  } catch (error: unknown) {
    return teacherDashboardErrorResponse(error);
  }
}
