import {
  authApiResponseSchema,
  type AuthApiResponse,
} from "@/lib/validation/auth";

export async function submitAuthRequest(
  endpoint: string,
  body?: unknown,
): Promise<AuthApiResponse> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload: unknown = await response.json();
  const parsed = authApiResponseSchema.safeParse(payload);

  if (!parsed.success) {
    throw new Error("驗證服務回應格式不正確，請稍後再試。");
  }

  return parsed.data;
}
