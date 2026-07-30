import {
  classroomErrorResponse,
  classroomSuccess,
  parseClassroomJson,
} from "@/lib/classroom/api";
import { enrollStudent } from "@/lib/classroom/service";
import { enrollStudentSchema } from "@/lib/validation/classroom";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const parsed = await parseClassroomJson(request, enrollStudentSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await context.params;
  try {
    const enrollment = await enrollStudent(id, parsed.data);
    return Response.json(classroomSuccess("學生已加入班級。", { enrollment }), {
      status: 201,
    });
  } catch (error: unknown) {
    return classroomErrorResponse(error);
  }
}
