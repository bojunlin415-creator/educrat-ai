import type { AuthorizationError } from "@/lib/authorization/domain/error";

export type AuthorizationResult<Value> =
  | Readonly<{ ok: true; value: Value }>
  | Readonly<{ error: AuthorizationError; ok: false }>;

export function authorizationSuccess<Value>(
  value: Value,
): AuthorizationResult<Value> {
  return { ok: true, value };
}

export function authorizationFailure(
  error: AuthorizationError,
): AuthorizationResult<never> {
  return { error, ok: false };
}
