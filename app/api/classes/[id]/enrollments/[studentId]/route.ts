import { classroomErrorResponse, classroomSuccess } from "@/lib/classroom/api";
import { removeStudent } from "@/lib/classroom/service";

interface RouteContext {
  readonly params: Promise<{
    readonly id: string;
    readonly studentId: string;
  }>;
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id, studentId } = await context.params;
  try {
    const enrollment = await removeStudent(id, studentId);
    return Response.json(classroomSuccess("學生已移出班級。", { enrollment }));
  } catch (error: unknown) {
    return classroomErrorResponse(error);
  }
}
