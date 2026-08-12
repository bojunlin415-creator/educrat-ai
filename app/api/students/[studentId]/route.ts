import {
  parseStudentJson,
  studentErrorResponse,
  studentSuccess,
} from "@/lib/student/api";
import {
  archiveStudent,
  getStudent,
  restoreStudent,
  updateStudent,
} from "@/lib/student/service";
import { updateStudentSchema } from "@/lib/validation/student";

type Context = { params: Promise<{ studentId: string }> };

export async function GET(_request: Request, context: Context) {
  const { studentId } = await context.params;
  try {
    return Response.json(
      studentSuccess("學生資料已載入。", {
        student: await getStudent(studentId),
      }),
    );
  } catch (error: unknown) {
    return studentErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  const parsed = await parseStudentJson(request, updateStudentSchema);
  if (!parsed.success) return parsed.response;
  const { studentId } = await context.params;
  try {
    return Response.json(
      studentSuccess("學生資料已更新。", {
        student: await updateStudent(studentId, parsed.data),
      }),
    );
  } catch (error: unknown) {
    return studentErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  const { studentId } = await context.params;
  try {
    return Response.json(
      studentSuccess("學生已封存。", {
        student: await archiveStudent(studentId),
      }),
    );
  } catch (error: unknown) {
    return studentErrorResponse(error);
  }
}

export async function POST(_request: Request, context: Context) {
  const { studentId } = await context.params;
  try {
    return Response.json(
      studentSuccess("學生已還原。", {
        student: await restoreStudent(studentId),
      }),
    );
  } catch (error: unknown) {
    return studentErrorResponse(error);
  }
}
