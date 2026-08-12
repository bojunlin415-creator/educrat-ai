import type { SubjectCapability } from "@/lib/subjects/capabilities";
import type { CanonicalSubjectId } from "@/lib/subjects/subject-types";

export const SUBJECT_CAPABILITY_ERROR_CODE =
  "subject_capability_unavailable" as const;

export const SUBJECT_CAPABILITY_HTTP_STATUS = 422 as const;

export type SubjectCapabilityFailureReason =
  "UNKNOWN_SUBJECT" | "UNKNOWN_CAPABILITY" | "NOT_APPROVED" | "NOT_AVAILABLE";

export class SubjectCapabilityError extends Error {
  readonly capability: SubjectCapability | "unknown";
  readonly code = SUBJECT_CAPABILITY_ERROR_CODE;
  readonly reason: SubjectCapabilityFailureReason;
  readonly subject: CanonicalSubjectId | "unknown";

  constructor(input: {
    readonly capability: SubjectCapability | "unknown";
    readonly reason: SubjectCapabilityFailureReason;
    readonly subject: CanonicalSubjectId | "unknown";
  }) {
    super("此科目目前不支援這項功能。");
    this.name = "SubjectCapabilityError";
    this.capability = input.capability;
    this.reason = input.reason;
    this.subject = input.subject;
  }
}

export function subjectCapabilityFailure(error: SubjectCapabilityError) {
  return Object.freeze({
    error: Object.freeze({
      capability: error.capability,
      code: error.code,
      subject: error.subject,
    }),
    message: error.message,
    success: false as const,
  });
}
