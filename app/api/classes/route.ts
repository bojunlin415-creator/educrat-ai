import {
  classroomErrorResponse,
  classroomSuccess,
  parseClassroomJson,
} from "@/lib/classroom/api";
import { createClass, listClasses } from "@/lib/classroom/service";
import { createClassSchema } from "@/lib/validation/classroom";

export async function GET() {
  try {
    const classes = await listClasses();
    return Response.json(classroomSuccess("班級列表已載入。", { classes }));
  } catch (error: unknown) {
    return classroomErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const parsed = await parseClassroomJson(request, createClassSchema);
  if (!parsed.success) return parsed.response;

  try {
    const classroom = await createClass(parsed.data);
    return Response.json(
      classroomSuccess("班級已建立。", { class: classroom }),
      { status: 201 },
    );
  } catch (error: unknown) {
    return classroomErrorResponse(error);
  }
}
