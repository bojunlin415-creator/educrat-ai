import {
  parseStudentJson,
  studentErrorResponse,
  studentFailure,
  studentSuccess,
} from "@/lib/student/api";
import { createStudent, listStudents } from "@/lib/student/service";
import {
  createStudentSchema,
  listStudentsQuerySchema,
} from "@/lib/validation/student";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = listStudentsQuerySchema.safeParse(
    Object.fromEntries(url.searchParams),
  );
  if (!parsed.success) {
    return Response.json(
      studentFailure(
        "學生列表查詢格式不正確。",
        parsed.error.flatten(),
        "invalid_input",
      ),
      { status: 400 },
    );
  }
  try {
    const result = await listStudents(parsed.data);
    console.info(
      "[student-api]",
      JSON.stringify({ method: "GET", route: "/api/students", status: 200 }),
    );
    return Response.json(studentSuccess("學生列表已載入。", result));
  } catch (error: unknown) {
    const response = studentErrorResponse(error);
    console.info(
      "[student-api]",
      JSON.stringify({
        method: "GET",
        route: "/api/students",
        status: response.status,
      }),
    );
    return response;
  }
}

export async function POST(request: Request) {
  const parsed = await parseStudentJson(request, createStudentSchema);
  if (!parsed.success) return parsed.response;
  try {
    const student = await createStudent(parsed.data);
    console.info(
      "[student-api]",
      JSON.stringify({
        method: "POST",
        route: "/api/students",
        status: 201,
        studentId: student.id,
      }),
    );
    return Response.json(studentSuccess("學生已建立。", { student }), {
      status: 201,
    });
  } catch (error: unknown) {
    return studentErrorResponse(error);
  }
}
