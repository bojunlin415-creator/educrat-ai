import type { z } from "zod";
import {
  AccessControlError,
  getAccessControlErrorStatus,
} from "@/lib/access-control/errors";

const MAX_ACCESS_BODY_BYTES = 16 * 1024;

type ParseResult<T> =
  | { readonly body: unknown; readonly data: T; readonly success: true }
  | {
      readonly body: unknown;
      readonly failureSource:
        | "content_type"
        | "json_parse"
        | "request_size"
        | "zod_schema";
      readonly response: Response;
      readonly responseStatus: number;
      readonly success: false;
      readonly validationErrors?: unknown;
    };

type AccessApiLogEntry = {
  readonly payload: unknown;
  readonly response: Readonly<Record<string, unknown>>;
  readonly route: string;
  readonly service: unknown;
  readonly validation: unknown;
};

export function accessControlSuccess(
  message: string,
  extra: Record<string, unknown> = {},
) {
  return { message, success: true, ...extra };
}

export function accessControlFailure(
  message: string,
  fieldErrors?: Record<string, string[] | undefined>,
  code?: string,
  details?: unknown,
) {
  const normalized = fieldErrors
    ? Object.fromEntries(
        Object.entries(fieldErrors).filter(
          (entry): entry is [string, string[]] => Boolean(entry[1]),
        ),
      )
    : undefined;
  return {
    code,
    details: details ?? normalized,
    error: message,
    fieldErrors: normalized,
    message,
    success: false,
  };
}

export function logAccessApi(entry: AccessApiLogEntry) {
  console.info(
    "[access-api]",
    JSON.stringify({
      payload: entry.payload,
      response: entry.response,
      route: entry.route,
      service: entry.service,
      validation: entry.validation,
    }),
  );
}

export async function parseAccessControlJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    const responseStatus = 415;
    return {
      response: Response.json(
        accessControlFailure("請使用 JSON 格式送出存取管理資料。", undefined, undefined, {
          contentType: request.headers.get("content-type"),
        }),
        { status: responseStatus },
      ),
      body: null,
      failureSource: "content_type",
      responseStatus,
      success: false,
    };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_ACCESS_BODY_BYTES
  ) {
    const responseStatus = 413;
    return {
      response: Response.json(
        accessControlFailure("送出的存取管理資料過大。", undefined, undefined, {
          declaredLength,
          maxBytes: MAX_ACCESS_BODY_BYTES,
        }),
        { status: responseStatus },
      ),
      body: null,
      failureSource: "request_size",
      responseStatus,
      success: false,
    };
  }

  let body: unknown;
  let rawBody = "";
  try {
    rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_ACCESS_BODY_BYTES) {
      const responseStatus = 413;
      return {
        response: Response.json(
          accessControlFailure("送出的存取管理資料過大。", undefined, undefined, {
            maxBytes: MAX_ACCESS_BODY_BYTES,
          }),
          { status: responseStatus },
        ),
        body: rawBody,
        failureSource: "request_size",
        responseStatus,
        success: false,
      };
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    const responseStatus = 400;
    return {
      response: Response.json(
        accessControlFailure("JSON 資料格式不正確。", undefined, undefined, {
          rawBody,
        }),
        {
          status: responseStatus,
        },
      ),
      body: rawBody,
      failureSource: "json_parse",
      responseStatus,
      success: false,
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const responseStatus = 400;
    const validationErrors = result.error.flatten();
    return {
      response: Response.json(
        accessControlFailure(
          "請修正標示的存取管理欄位。",
          validationErrors.fieldErrors,
          "invalid_input",
          validationErrors,
        ),
        { status: responseStatus },
      ),
      body,
      failureSource: "zod_schema",
      responseStatus,
      success: false,
      validationErrors,
    };
  }
  return { body, data: result.data, success: true };
}

export function accessControlErrorResponse(error: unknown): Response {
  if (error instanceof AccessControlError) {
    return Response.json(
      accessControlFailure(error.message, undefined, error.code),
      { status: getAccessControlErrorStatus(error) },
    );
  }
  return Response.json(
    accessControlFailure("目前無法處理存取管理，請稍後再試。"),
    { status: 503 },
  );
}
