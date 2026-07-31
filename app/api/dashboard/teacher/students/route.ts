import {
  parseTeacherDashboardQuery,
  teacherDashboardErrorResponse,
  teacherDashboardSuccess,
} from "@/lib/teacher-dashboard/api";
import { getTeacherDashboardStudents } from "@/lib/teacher-dashboard/service";
import { teacherDashboardStudentsQuerySchema } from "@/lib/validation/teacher-dashboard";

export async function GET(request: Request) {
  const parsed = parseTeacherDashboardQuery(
    request.url,
    teacherDashboardStudentsQuerySchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const students = await getTeacherDashboardStudents(parsed.data);
    return Response.json(
      teacherDashboardSuccess("學生表現排序已載入。", { students }),
    );
  } catch (error: unknown) {
    return teacherDashboardErrorResponse(error);
  }
}
