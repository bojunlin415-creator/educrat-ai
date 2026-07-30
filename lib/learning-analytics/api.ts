import type { z } from "zod";
import {
  getLearningAnalyticsErrorStatus,
  LearningAnalyticsError,
} from "@/lib/learning-analytics/errors";

const MAX_LEARNING_ANALYTICS_BODY_BYTES = 48 * 1024;

type ParseResult<T> =
  | { readonly data: T; readonly success: true }
  | { readonly response: Response; readonly success: false };

export function learningAnalyticsSuccess(
  message: string,
  extra: Record<string, unknown> = {},
) {
  return { success: true, message, ...extra };
}

export function learningAnalyticsFailure(
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

export async function parseLearningAnalyticsJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    return {
      response: Response.json(
        learningAnalyticsFailure("請使用 JSON 格式送出學習事件。"),
        { status: 415 },
      ),
      success: false,
    };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_LEARNING_ANALYTICS_BODY_BYTES
  ) {
    return {
      response: Response.json(
        learningAnalyticsFailure("送出的學習事件過大。"),
        {
          status: 413,
        },
      ),
      success: false,
    };
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (
      new TextEncoder().encode(rawBody).byteLength >
      MAX_LEARNING_ANALYTICS_BODY_BYTES
    ) {
      return {
        response: Response.json(
          learningAnalyticsFailure("送出的學習事件過大。"),
          { status: 413 },
        ),
        success: false,
      };
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return {
      response: Response.json(
        learningAnalyticsFailure("JSON 資料格式不正確。"),
        {
          status: 400,
        },
      ),
      success: false,
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      response: Response.json(
        learningAnalyticsFailure(
          "請修正標示的學習事件欄位。",
          result.error.flatten().fieldErrors,
        ),
        { status: 422 },
      ),
      success: false,
    };
  }

  return { data: result.data, success: true };
}

export function parseLearningAnalyticsQuery<T>(
  url: string,
  schema: z.ZodType<T>,
): ParseResult<T> {
  const searchParams = new URL(url).searchParams;
  const raw = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      response: Response.json(
        learningAnalyticsFailure(
          "請修正標示的查詢欄位。",
          result.error.flatten().fieldErrors,
        ),
        { status: 422 },
      ),
      success: false,
    };
  }
  return { data: result.data, success: true };
}

export function learningAnalyticsErrorResponse(error: unknown): Response {
  if (error instanceof LearningAnalyticsError) {
    return Response.json(
      learningAnalyticsFailure(error.message, undefined, error.code),
      { status: getLearningAnalyticsErrorStatus(error) },
    );
  }

  return Response.json(
    learningAnalyticsFailure("目前無法處理學習分析資料，請稍後再試。"),
    { status: 503 },
  );
}
