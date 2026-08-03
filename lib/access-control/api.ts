import type { z } from "zod";
import {
  AccessControlError,
  getAccessControlErrorStatus,
} from "@/lib/access-control/errors";

const MAX_ACCESS_BODY_BYTES = 16 * 1024;

type ParseResult<T> =
  | { readonly data: T; readonly success: true }
  | { readonly response: Response; readonly success: false };

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

export async function parseAccessControlJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    return {
      response: Response.json(
        accessControlFailure("請使用 JSON 格式送出存取管理資料。"),
        { status: 415 },
      ),
      success: false,
    };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_ACCESS_BODY_BYTES
  ) {
    return {
      response: Response.json(
        accessControlFailure("送出的存取管理資料過大。"),
        { status: 413 },
      ),
      success: false,
    };
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_ACCESS_BODY_BYTES) {
      return {
        response: Response.json(
          accessControlFailure("送出的存取管理資料過大。"),
          { status: 413 },
        ),
        success: false,
      };
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return {
      response: Response.json(accessControlFailure("JSON 資料格式不正確。"), {
        status: 400,
      }),
      success: false,
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      response: Response.json(
        accessControlFailure(
          "請修正標示的存取管理欄位。",
          result.error.flatten().fieldErrors,
        ),
        { status: 422 },
      ),
      success: false,
    };
  }
  return { data: result.data, success: true };
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
