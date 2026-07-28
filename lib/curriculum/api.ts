import type { z } from "zod";
import {
  CurriculumError,
  getCurriculumErrorStatus,
} from "@/lib/curriculum/errors";

const MAX_CURRICULUM_BODY_BYTES = 16 * 1024;

type ParseResult<T> =
  { success: true; data: T } | { success: false; response: Response };

export function curriculumSuccess(
  message: string,
  extra: Record<string, unknown> = {},
) {
  return { success: true, message, ...extra };
}

export function curriculumFailure(
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
  return { success: false, message, fieldErrors: normalized, code };
}

export async function parseCurriculumJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    return {
      success: false,
      response: Response.json(
        curriculumFailure("請使用 JSON 格式送出教材資料。"),
        { status: 415 },
      ),
    };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_CURRICULUM_BODY_BYTES
  ) {
    return {
      success: false,
      response: Response.json(curriculumFailure("送出的教材資料過大。"), {
        status: 413,
      }),
    };
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (
      new TextEncoder().encode(rawBody).byteLength > MAX_CURRICULUM_BODY_BYTES
    ) {
      return {
        success: false,
        response: Response.json(curriculumFailure("送出的教材資料過大。"), {
          status: 413,
        }),
      };
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return {
      success: false,
      response: Response.json(curriculumFailure("JSON 資料格式不正確。"), {
        status: 400,
      }),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: Response.json(
        curriculumFailure(
          "請修正標示的教材欄位。",
          result.error.flatten().fieldErrors,
        ),
        { status: 422 },
      ),
    };
  }

  return { success: true, data: result.data };
}

export function curriculumErrorResponse(error: unknown): Response {
  if (error instanceof CurriculumError) {
    return Response.json(
      curriculumFailure(error.message, undefined, error.code),
      {
        status: getCurriculumErrorStatus(error),
      },
    );
  }

  return Response.json(
    curriculumFailure("目前無法處理教材資料，請稍後再試。"),
    { status: 503 },
  );
}
