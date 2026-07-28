export const RECYCLE_BIN_ERROR_CODES = [
  "DUPLICATE_RECYCLE_BIN_RESOURCE_TYPE",
  "DUPLICATE_RECYCLE_BIN_TRANSITION",
  "INVALID_RECYCLE_BIN_ENTRY",
  "INVALID_RECYCLE_BIN_INPUT",
  "INVALID_RECYCLE_BIN_POLICY_OUTPUT",
  "INVALID_RECYCLE_BIN_REQUEST",
  "UNKNOWN_RECYCLE_BIN_RESOURCE",
  "UNKNOWN_RECYCLE_BIN_TRANSITION",
  "UNSUPPORTED_RECYCLE_BIN_VERSION",
] as const;

export type RecycleBinErrorCode = (typeof RECYCLE_BIN_ERROR_CODES)[number];

export class RecycleBinError extends Error {
  readonly code: RecycleBinErrorCode;

  constructor(code: RecycleBinErrorCode) {
    super(code);
    this.name = "RecycleBinError";
    this.code = code;
  }
}
