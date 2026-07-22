export const AUDIT_ERROR_CODES = [
  "INVALID_AUDIT_INPUT",
  "INVALID_AUDIT_ACTOR",
  "INVALID_AUDIT_SCOPE",
  "INVALID_AUDIT_RESOURCE",
  "INVALID_AUDIT_ACTION",
  "INVALID_AUDIT_METADATA",
  "INVALID_AUDIT_TIMESTAMP",
  "INVALID_AUDIT_HASH",
  "INVALID_AUDIT_VERSION",
  "INVALID_AUDIT_CHAIN_HEAD",
  "AUDIT_SERIALIZATION_FAILED",
] as const;

export type AuditErrorCode = (typeof AUDIT_ERROR_CODES)[number];

export class AuditError extends Error {
  readonly code: AuditErrorCode;

  constructor(code: AuditErrorCode) {
    super(code);
    this.name = "AuditError";
    this.code = code;
  }
}
