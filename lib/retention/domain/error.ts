export const RETENTION_ERROR_CODES = [
  "INVALID_RETENTION_INPUT",
  "UNKNOWN_RETENTION_RESOURCE",
  "DUPLICATE_RETENTION_RESOURCE",
  "UNKNOWN_RETENTION_CATEGORY",
  "DUPLICATE_RETENTION_CATEGORY",
  "UNKNOWN_RETENTION_TRANSITION",
  "DUPLICATE_RETENTION_TRANSITION",
  "UNSUPPORTED_RETENTION_VERSION",
  "INVALID_RETENTION_RULE",
  "INVALID_LEGAL_HOLD",
  "DUPLICATE_LEGAL_HOLD",
  "INVALID_RETENTION_POLICY_RESULT",
] as const;

export type RetentionErrorCode = (typeof RETENTION_ERROR_CODES)[number];

export class RetentionError extends Error {
  readonly code: RetentionErrorCode;

  constructor(code: RetentionErrorCode) {
    super(code);
    this.name = "RetentionError";
    this.code = code;
  }
}
