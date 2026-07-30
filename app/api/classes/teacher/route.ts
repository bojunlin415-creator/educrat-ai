import { classroomErrorResponse, classroomSuccess } from "@/lib/classroom/api";
import { listTeacherClasses } from "@/lib/classroom/service";

export async function GET() {
  try {
    const classes = await listTeacherClasses();
    return Response.json(classroomSuccess("教師班級已載入。", { classes }));
  } catch (error: unknown) {
    return classroomErrorResponse(error);
  }
}
