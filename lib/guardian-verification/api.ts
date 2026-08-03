import type { z } from "zod";
import {
  getGuardianVerificationErrorStatus,
  GuardianVerificationError,
} from "@/lib/guardian-verification/errors";

const MAX_BODY_BYTES = 16_384;

type ParseResult<T> =
  | { readonly data: T; readonly success: true }
  | { readonly response: Response; readonly success: false };

export function guardianVerificationSuccess(
  message: string,
  extra: Record<string, unknown> = {},
) {
  return { success: true, message, ...extra };
}

export function guardianVerificationFailure(
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

export async function parseGuardianVerificationJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    return {
      response: Response.json(
        guardianVerificationFailure("請使用 JSON 格式送出家長驗證資料。"),
        { status: 415 },
      ),
      success: false,
    };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return {
      response: Response.json(
        guardianVerificationFailure("送出的家長驗證資料過大。"),
        { status: 413 },
      ),
      success: false,
    };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      response: Response.json(
        guardianVerificationFailure("JSON 資料格式不正確。"),
        { status: 400 },
      ),
      success: false,
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      response: Response.json(
        guardianVerificationFailure(
          "請修正標示的家長驗證欄位。",
          result.error.flatten().fieldErrors,
        ),
        { status: 422 },
      ),
      success: false,
    };
  }
  return { data: result.data, success: true };
}

export function guardianVerificationErrorResponse(error: unknown): Response {
  if (error instanceof GuardianVerificationError) {
    return Response.json(
      guardianVerificationFailure(error.message, undefined, error.code),
      { status: getGuardianVerificationErrorStatus(error) },
    );
  }

  return Response.json(
    guardianVerificationFailure("目前無法處理家長驗證，請稍後再試。"),
    { status: 503 },
  );
}
