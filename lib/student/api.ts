import type { z } from "zod";
import { getStudentErrorStatus, StudentError } from "@/lib/student/errors";

const MAX_STUDENT_BODY_BYTES = 24 * 1024;

type ParseResult<T> =
  | { readonly data: T; readonly success: true }
  | { readonly response: Response; readonly success: false };

export function studentSuccess(
  message: string,
  extra: Record<string, unknown> = {},
) {
  return { message, success: true, ...extra };
}

export function studentFailure(
  message: string,
  details?: unknown,
  code?: string,
) {
  return { code, details, error: message, message, success: false };
}

export async function parseStudentJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    return {
      response: Response.json(
        studentFailure("請使用 JSON 格式送出學生資料。"),
        {
          status: 415,
        },
      ),
      success: false,
    };
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_STUDENT_BODY_BYTES
  ) {
    return {
      response: Response.json(studentFailure("送出的學生資料過大。"), {
        status: 413,
      }),
      success: false,
    };
  }
  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_STUDENT_BODY_BYTES) {
      return {
        response: Response.json(studentFailure("送出的學生資料過大。"), {
          status: 413,
        }),
        success: false,
      };
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return {
      response: Response.json(studentFailure("JSON 資料格式不正確。"), {
        status: 400,
      }),
      success: false,
    };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return {
      response: Response.json(
        studentFailure(
          "請修正標示的學生欄位。",
          parsed.error.flatten(),
          "invalid_input",
        ),
        { status: 400 },
      ),
      success: false,
    };
  }
  return { data: parsed.data, success: true };
}

export function studentErrorResponse(error: unknown) {
  if (error instanceof StudentError) {
    return Response.json(studentFailure(error.message, undefined, error.code), {
      status: getStudentErrorStatus(error),
    });
  }
  return Response.json(studentFailure("目前無法處理學生資料，請稍後再試。"), {
    status: 503,
  });
}
