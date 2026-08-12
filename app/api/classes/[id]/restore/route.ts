import { classroomErrorResponse, classroomSuccess } from "@/lib/classroom/api";
import { restoreClass } from "@/lib/classroom/service";

type Context = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: Context) {
  const { id } = await context.params;
  try {
    const classroom = await restoreClass(id);
    console.info(
      "[class-api]",
      JSON.stringify({
        classId: id,
        method: "POST",
        route: "/api/classes/[classId]/restore",
        status: 200,
      }),
    );
    return Response.json(
      classroomSuccess("班級已還原。", { class: classroom }),
    );
  } catch (error: unknown) {
    const response = classroomErrorResponse(error);
    console.info(
      "[class-api]",
      JSON.stringify({
        classId: id,
        method: "POST",
        route: "/api/classes/[classId]/restore",
        status: response.status,
      }),
    );
    return response;
  }
}
