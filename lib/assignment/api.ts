import type { z } from "zod";
import {
  AssignmentError,
  getAssignmentErrorStatus,
} from "@/lib/assignment/errors";

const MAX_ASSIGNMENT_BODY_BYTES = 32 * 1024;

type ParseResult<T> =
  | { readonly data: T; readonly success: true }
  | { readonly response: Response; readonly success: false };

export function assignmentSuccess(
  message: string,
  extra: Record<string, unknown> = {},
) {
  return { success: true, message, ...extra };
}

export function assignmentFailure(
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

export async function parseAssignmentJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    return {
      response: Response.json(
        assignmentFailure("請使用 JSON 格式送出派發資料。"),
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
    declaredLength > MAX_ASSIGNMENT_BODY_BYTES
  ) {
    return {
      response: Response.json(assignmentFailure("送出的派發資料過大。"), {
        status: 413,
      }),
      success: false,
    };
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (
      new TextEncoder().encode(rawBody).byteLength > MAX_ASSIGNMENT_BODY_BYTES
    ) {
      return {
        response: Response.json(assignmentFailure("送出的派發資料過大。"), {
          status: 413,
        }),
        success: false,
      };
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return {
      response: Response.json(assignmentFailure("JSON 資料格式不正確。"), {
        status: 400,
      }),
      success: false,
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      response: Response.json(
        assignmentFailure(
          "請修正標示的派發欄位。",
          result.error.flatten().fieldErrors,
        ),
        { status: 422 },
      ),
      success: false,
    };
  }

  return { data: result.data, success: true };
}

export function assignmentErrorResponse(error: unknown): Response {
  if (error instanceof AssignmentError) {
    return Response.json(
      assignmentFailure(error.message, undefined, error.code),
      {
        status: getAssignmentErrorStatus(error),
      },
    );
  }

  return Response.json(
    assignmentFailure("目前無法處理派發資料，請稍後再試。"),
    {
      status: 503,
    },
  );
}
