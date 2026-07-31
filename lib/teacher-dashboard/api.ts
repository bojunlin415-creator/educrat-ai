import type { z } from "zod";
import {
  getTeacherDashboardErrorStatus,
  TeacherDashboardError,
} from "@/lib/teacher-dashboard/errors";

type ParseResult<T> =
  | { readonly data: T; readonly success: true }
  | { readonly response: Response; readonly success: false };

export function teacherDashboardSuccess(
  message: string,
  extra: Record<string, unknown> = {},
) {
  return { success: true, message, ...extra };
}

export function teacherDashboardFailure(
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

export function parseTeacherDashboardQuery<T>(
  url: string,
  schema: z.ZodType<T>,
): ParseResult<T> {
  const result = schema.safeParse(
    Object.fromEntries(new URL(url).searchParams.entries()),
  );
  if (!result.success) {
    return {
      response: Response.json(
        teacherDashboardFailure(
          "請修正標示的教師儀表板查詢欄位。",
          result.error.flatten().fieldErrors,
        ),
        { status: 422 },
      ),
      success: false,
    };
  }
  return { data: result.data, success: true };
}

export function teacherDashboardErrorResponse(error: unknown): Response {
  if (error instanceof TeacherDashboardError) {
    return Response.json(
      teacherDashboardFailure(error.message, undefined, error.code),
      { status: getTeacherDashboardErrorStatus(error) },
    );
  }

  return Response.json(
    teacherDashboardFailure("目前無法載入教師儀表板，請稍後再試。"),
    { status: 503 },
  );
}
