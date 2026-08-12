import {
  isSubjectCapability,
  type SubjectCapability,
  type SubjectCapabilityAvailability,
} from "@/lib/subjects/capabilities";
import { resolveCanonicalSubjectId } from "@/lib/subjects/compatibility";
import {
  SubjectCapabilityError,
  type SubjectCapabilityFailureReason,
} from "@/lib/subjects/errors";
import {
  getSubjectCapabilityAvailability,
  isSubjectCapabilityApproved,
} from "@/lib/subjects/registry";
import type { CanonicalSubjectId } from "@/lib/subjects/subject-types";

export interface RequiredSubjectCapability {
  readonly availability: SubjectCapabilityAvailability;
  readonly capability: SubjectCapability;
  readonly subjectId: CanonicalSubjectId;
}

export function requireSubjectCapability(
  subject: unknown,
  capability: unknown,
): RequiredSubjectCapability {
  const subjectId = resolveCanonicalSubjectId(subject);
  const knownCapability = isSubjectCapability(capability) ? capability : null;

  let reason: SubjectCapabilityFailureReason | null = null;
  if (!subjectId) reason = "UNKNOWN_SUBJECT";
  else if (!knownCapability) reason = "UNKNOWN_CAPABILITY";
  else if (!isSubjectCapabilityApproved(subjectId, knownCapability)) {
    reason = "NOT_APPROVED";
  } else if (
    getSubjectCapabilityAvailability(subjectId, knownCapability) !==
    "IMPLEMENTED"
  ) {
    reason = "NOT_AVAILABLE";
  }

  if (reason || !subjectId || !knownCapability) {
    throw new SubjectCapabilityError({
      capability: knownCapability ?? "unknown",
      reason: reason ?? "NOT_AVAILABLE",
      subject: subjectId ?? "unknown",
    });
  }

  return Object.freeze({
    availability: "IMPLEMENTED",
    capability: knownCapability,
    subjectId,
  });
}
