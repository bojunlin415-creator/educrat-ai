import type { z } from "zod";
import type { AuthApiResponse } from "@/lib/validation/auth";

const MAX_AUTH_BODY_BYTES = 16_384;

type ParseResult<T> =
  { success: true; data: T } | { success: false; response: Response };

export async function parseAuthJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return {
      success: false,
      response: Response.json(authError("請使用 JSON 格式送出資料。"), {
        status: 415,
      }),
    };
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_AUTH_BODY_BYTES) {
    return {
      success: false,
      response: Response.json(authError("送出的資料過大。"), { status: 413 }),
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: Response.json(authError("JSON 資料格式不正確。"), {
        status: 400,
      }),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: Response.json(
        authError("請檢查輸入內容。", result.error.flatten().fieldErrors),
        { status: 422 },
      ),
    };
  }

  return { success: true, data: result.data };
}

export function authSuccess(
  message: string,
  extra: Pick<AuthApiResponse, "redirectTo" | "externalRedirectTo"> = {},
): AuthApiResponse {
  return { success: true, message, ...extra };
}

export function authError(
  message: string,
  fieldErrors?: Record<string, string[] | undefined>,
): AuthApiResponse {
  const normalized = fieldErrors
    ? Object.fromEntries(
        Object.entries(fieldErrors).filter(
          (entry): entry is [string, string[]] => Boolean(entry[1]),
        ),
      )
    : undefined;

  return { success: false, message, fieldErrors: normalized };
}
