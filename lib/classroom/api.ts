import type { z } from "zod";
import {
  ClassroomError,
  getClassroomErrorStatus,
} from "@/lib/classroom/errors";

const MAX_CLASSROOM_BODY_BYTES = 24 * 1024;

type ParseResult<T> =
  | { readonly data: T; readonly success: true }
  | { readonly response: Response; readonly success: false };

export function classroomSuccess(
  message: string,
  extra: Record<string, unknown> = {},
) {
  return { success: true, message, ...extra };
}

export function classroomFailure(
  message: string,
  fieldErrors?: Record<string, string[] | undefined>,
  code?: string,
) {
  const normalized = fieldErrors
    ? Object.fromEntries(
        Object.entries(fieldErrors).filter(
          (entry): entry is [string, string[]] => Boolean(entry[1]),
        ),
      )
    : undefined;
  return { code, fieldErrors: normalized, message, success: false };
}

export async function parseClassroomJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    return {
      response: Response.json(
        classroomFailure("請使用 JSON 格式送出班級資料。"),
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
    declaredLength > MAX_CLASSROOM_BODY_BYTES
  ) {
    return {
      response: Response.json(classroomFailure("送出的班級資料過大。"), {
        status: 413,
      }),
      success: false,
    };
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (
      new TextEncoder().encode(rawBody).byteLength > MAX_CLASSROOM_BODY_BYTES
    ) {
      return {
        response: Response.json(classroomFailure("送出的班級資料過大。"), {
          status: 413,
        }),
        success: false,
      };
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return {
      response: Response.json(classroomFailure("JSON 資料格式不正確。"), {
        status: 400,
      }),
      success: false,
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      response: Response.json(
        classroomFailure(
          "請修正標示的班級欄位。",
          result.error.flatten().fieldErrors,
        ),
        { status: 422 },
      ),
      success: false,
    };
  }

  return { data: result.data, success: true };
}

export function classroomErrorResponse(error: unknown): Response {
  if (error instanceof ClassroomError) {
    return Response.json(
      classroomFailure(error.message, undefined, error.code),
      {
        status: getClassroomErrorStatus(error),
      },
    );
  }

  return Response.json(classroomFailure("目前無法處理班級資料，請稍後再試。"), {
    status: 503,
  });
}
