import {
  classroomErrorResponse,
  classroomSuccess,
  parseClassroomJson,
} from "@/lib/classroom/api";
import { archiveClass, getClass, updateClass } from "@/lib/classroom/service";
import { observeLearnerShadowConsumer } from "@/lib/learner-convergence/server";
import { updateClassSchema } from "@/lib/validation/classroom";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const classroom = await getClass(id);
    await observeLearnerShadowConsumer({
      consumer: "class_read_detail",
      scope: { classIds: [classroom.id] },
    });
    return Response.json(
      classroomSuccess("班級資料已載入。", { class: classroom }),
    );
  } catch (error: unknown) {
    return classroomErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const parsed = await parseClassroomJson(request, updateClassSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await context.params;
  try {
    const classroom = await updateClass(id, parsed.data);
    return Response.json(
      classroomSuccess("班級已更新。", { class: classroom }),
    );
  } catch (error: unknown) {
    return classroomErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const classroom = await archiveClass(id);
    return Response.json(
      classroomSuccess("班級已封存。", { class: classroom }),
    );
  } catch (error: unknown) {
    return classroomErrorResponse(error);
  }
}
