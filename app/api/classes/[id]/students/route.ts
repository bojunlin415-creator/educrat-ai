import {
  parseStudentJson,
  studentErrorResponse,
  studentSuccess,
} from "@/lib/student/api";
import { assignStudentToClass } from "@/lib/student/service";
import { z } from "zod";

const schema = z.object({ studentId: z.uuid() }).strict();
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const parsed = await parseStudentJson(request, schema);
  if (!parsed.success) return parsed.response;
  const { id } = await context.params;
  try {
    const membership = await assignStudentToClass(id, parsed.data.studentId);
    return Response.json(studentSuccess("學生已加入班級。", { membership }), {
      status: 201,
    });
  } catch (error: unknown) {
    return studentErrorResponse(error);
  }
}
