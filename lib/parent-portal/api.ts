import type { z } from "zod";
import {
  getParentPortalErrorStatus,
  ParentPortalError,
} from "@/lib/parent-portal/errors";

type ParseResult<T> =
  | { readonly data: T; readonly success: true }
  | { readonly response: Response; readonly success: false };

export function parentPortalSuccess(
  message: string,
  extra: Record<string, unknown> = {},
) {
  return { success: true, message, ...extra };
}

export function parentPortalFailure(
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

export function parseParentPortalQuery<T>(
  url: string,
  schema: z.ZodType<T>,
): ParseResult<T> {
  const result = schema.safeParse(
    Object.fromEntries(new URL(url).searchParams.entries()),
  );
  if (!result.success) {
    return {
      response: Response.json(
        parentPortalFailure(
          "請修正標示的家長入口查詢欄位。",
          result.error.flatten().fieldErrors,
        ),
        { status: 422 },
      ),
      success: false,
    };
  }
  return { data: result.data, success: true };
}

export function parentPortalErrorResponse(error: unknown): Response {
  if (error instanceof ParentPortalError) {
    return Response.json(
      parentPortalFailure(error.message, undefined, error.code),
      {
        status: getParentPortalErrorStatus(error),
      },
    );
  }

  return Response.json(
    parentPortalFailure("目前無法載入家長入口，請稍後再試。"),
    {
      status: 503,
    },
  );
}
