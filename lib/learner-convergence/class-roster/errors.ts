export type ClassRosterSourceErrorCode =
  "CANONICAL_INTEGRITY_FAILURE" | "CANONICAL_RUNTIME_FAILURE";

export class ClassRosterSourceError extends Error {
  readonly code: ClassRosterSourceErrorCode;

  constructor(code: ClassRosterSourceErrorCode, options?: ErrorOptions) {
    super(code.toLowerCase(), options);
    this.name = "ClassRosterSourceError";
    this.code = code;
    Object.freeze(this);
  }
}

export function isCanonicalRosterRuntimeFailure(
  error: unknown,
): error is ClassRosterSourceError {
  return (
    error instanceof ClassRosterSourceError &&
    error.code === "CANONICAL_RUNTIME_FAILURE"
  );
}
