export const AUTHORIZATION_ERROR_CODES = [
  "INVALID_PERMISSION_KEY",
  "INVALID_CONTEXT",
  "PERMISSION_RESOLUTION_FAILED",
  "POLICY_RESOLUTION_FAILED",
  "SYSTEM_ERROR",
] as const;

export type AuthorizationErrorCode = (typeof AUTHORIZATION_ERROR_CODES)[number];

export class AuthorizationError extends Error {
  readonly code: AuthorizationErrorCode;

  constructor(code: AuthorizationErrorCode) {
    super(code);
    this.name = "AuthorizationError";
    this.code = code;
  }
}
