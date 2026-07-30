import type { z } from "zod";
import {
  getReportingErrorStatus,
  ReportingError,
} from "@/lib/reporting/errors";

type ParseResult<T> =
  | { readonly data: T; readonly success: true }
  | { readonly response: Response; readonly success: false };

export function reportingSuccess(
  message: string,
  extra: Record<string, unknown> = {},
) {
  return { success: true, message, ...extra };
}

export function reportingFailure(
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

export function parseReportingQuery<T>(
  url: string,
  schema: z.ZodType<T>,
): ParseResult<T> {
  const result = schema.safeParse(
    Object.fromEntries(new URL(url).searchParams.entries()),
  );
  if (!result.success) {
    return {
      response: Response.json(
        reportingFailure(
          "請修正標示的報表查詢欄位。",
          result.error.flatten().fieldErrors,
        ),
        { status: 422 },
      ),
      success: false,
    };
  }
  return { data: result.data, success: true };
}

export function reportingErrorResponse(error: unknown): Response {
  if (error instanceof ReportingError) {
    return Response.json(
      reportingFailure(error.message, undefined, error.code),
      {
        status: getReportingErrorStatus(error),
      },
    );
  }

  return Response.json(reportingFailure("目前無法產生報表，請稍後再試。"), {
    status: 503,
  });
}
