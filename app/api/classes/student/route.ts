import { classroomErrorResponse, classroomSuccess } from "@/lib/classroom/api";
import { listStudentClasses } from "@/lib/classroom/service";

export async function GET() {
  try {
    const enrollments = await listStudentClasses();
    return Response.json(classroomSuccess("學生班級已載入。", { enrollments }));
  } catch (error: unknown) {
    return classroomErrorResponse(error);
  }
}
