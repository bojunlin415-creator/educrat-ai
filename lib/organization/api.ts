import type { z } from "zod";
import {
  getOrganizationErrorStatus,
  OrganizationError,
} from "@/lib/organization/errors";

const MAX_ORGANIZATION_BODY_BYTES = 16 * 1024;

type ParseResult<T> =
  { success: true; data: T } | { success: false; response: Response };

export function organizationSuccess(
  message: string,
  extra: Record<string, unknown> = {},
) {
  return { success: true, message, ...extra };
}

export function organizationFailure(
  message: string,
  fieldErrors?: Record<string, string[] | undefined>,
) {
  const normalized = fieldErrors
    ? Object.fromEntries(
        Object.entries(fieldErrors).filter(
          (entry): entry is [string, string[]] => Boolean(entry[1]),
        ),
      )
    : undefined;
  return { success: false, message, fieldErrors: normalized };
}

export async function parseOrganizationJson<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  if (
    request.headers.get("content-type")?.split(";", 1)[0] !== "application/json"
  ) {
    return {
      success: false,
      response: Response.json(
        organizationFailure("請使用 JSON 格式送出機構資料。"),
        { status: 415 },
      ),
    };
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_ORGANIZATION_BODY_BYTES
  ) {
    return {
      success: false,
      response: Response.json(organizationFailure("送出的機構資料過大。"), {
        status: 413,
      }),
    };
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (
      new TextEncoder().encode(rawBody).byteLength > MAX_ORGANIZATION_BODY_BYTES
    ) {
      return {
        success: false,
        response: Response.json(organizationFailure("送出的機構資料過大。"), {
          status: 413,
        }),
      };
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return {
      success: false,
      response: Response.json(organizationFailure("JSON 資料格式不正確。"), {
        status: 400,
      }),
    };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    return {
      success: false,
      response: Response.json(
        organizationFailure(
          "請修正標示的機構欄位。",
          result.error.flatten().fieldErrors,
        ),
        { status: 422 },
      ),
    };
  }

  return { success: true, data: result.data };
}

export function organizationErrorResponse(error: unknown): Response {
  if (error instanceof OrganizationError) {
    return Response.json(organizationFailure(error.message), {
      status: getOrganizationErrorStatus(error),
    });
  }

  return Response.json(
    organizationFailure("目前無法處理機構資料，請稍後再試。"),
    { status: 503 },
  );
}
