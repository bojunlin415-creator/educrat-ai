import type { z } from "zod";
import {
  AdaptiveLearningError,
  getAdaptiveLearningErrorStatus,
} from "@/lib/adaptive-learning/errors";

type ParseResult<T> =
  | { readonly data: T; readonly success: true }
  | { readonly response: Response; readonly success: false };

export function adaptiveLearningSuccess(
  message: string,
  extra: Record<string, unknown> = {},
) {
  return { success: true, message, ...extra };
}

export function adaptiveLearningFailure(
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

export function parseAdaptiveLearningQuery<T>(
  url: string,
  schema: z.ZodType<T>,
): ParseResult<T> {
  const raw = Object.fromEntries(new URL(url).searchParams.entries());
  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      response: Response.json(
        adaptiveLearningFailure(
          "請修正標示的推薦查詢欄位。",
          result.error.flatten().fieldErrors,
        ),
        { status: 422 },
      ),
      success: false,
    };
  }
  return { data: result.data, success: true };
}

export function adaptiveLearningErrorResponse(error: unknown): Response {
  if (error instanceof AdaptiveLearningError) {
    return Response.json(
      adaptiveLearningFailure(error.message, undefined, error.code),
      { status: getAdaptiveLearningErrorStatus(error) },
    );
  }

  return Response.json(
    adaptiveLearningFailure("目前無法處理學習推薦，請稍後再試。"),
    { status: 503 },
  );
}
