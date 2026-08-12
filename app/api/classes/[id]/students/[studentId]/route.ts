import { studentErrorResponse, studentSuccess } from "@/lib/student/api";
import { removeStudentFromClass } from "@/lib/student/service";

type Context = { params: Promise<{ id: string; studentId: string }> };

export async function DELETE(_request: Request, context: Context) {
  const { id, studentId } = await context.params;
  try {
    const membership = await removeStudentFromClass(id, studentId);
    return Response.json(studentSuccess("學生已移出班級。", { membership }));
  } catch (error: unknown) {
    return studentErrorResponse(error);
  }
}
