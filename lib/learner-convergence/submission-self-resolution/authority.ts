import {
  SUBMISSION_SELF_RESOLUTION_VERSION,
  SubmissionSelfResolutionError,
  type CanonicalResolutionInput,
  type CanonicalSubmissionIdentity,
  type SubmissionSelfAuthorityObserver,
  type SubmissionSelfReadResult,
  type SubmissionSelfRecipientSource,
  type SubmissionSelfWriteAuthority,
  SubmissionSelfSourceError,
} from "@/lib/learner-convergence/submission-self-resolution/domain";
import {
  LEARNER_CUTOVER_CONTROL_MODES,
  type LearnerCutoverControlMode,
} from "@/lib/learner-convergence/cutover/domain";
import type { AssignmentRecipientProjection } from "@/lib/learner-convergence/assignment-recipient/domain";

export function resolveSubmissionSelfAuthorityMode(input: {
  readonly configuredMode?: string;
  readonly selectedMode: LearnerCutoverControlMode;
}): LearnerCutoverControlMode {
  if (!input.configuredMode?.trim()) return input.selectedMode;
  const normalized = input.configuredMode.trim();
  return LEARNER_CUTOVER_CONTROL_MODES.some((mode) => mode === normalized)
    ? (normalized as LearnerCutoverControlMode)
    : "LEGACY_ONLY";
}

export function resolveSubmissionSelfWriteAuthority(
  mode: LearnerCutoverControlMode,
): SubmissionSelfWriteAuthority {
  return mode === "LEGACY_ONLY" || mode === "LEGACY_PRIMARY_CANONICAL_SHADOW"
    ? "LEGACY"
    : "CANONICAL";
}

function freezeRecipients(
  recipients: Awaited<
    ReturnType<SubmissionSelfRecipientSource["loadCanonical"]>
  >,
) {
  return Object.freeze(
    recipients.map((recipient) =>
      Object.freeze({
        ...recipient,
        source_class_ids: Object.freeze([...recipient.source_class_ids]),
      }),
    ),
  );
}

export async function readSubmissionSelfRecipients(input: {
  readonly action: "READ";
  readonly assignmentId: string | null;
  readonly correlationId: string;
  readonly mode: LearnerCutoverControlMode;
  readonly observer: SubmissionSelfAuthorityObserver;
  readonly organizationId: string;
  readonly source: SubmissionSelfRecipientSource;
}): Promise<SubmissionSelfReadResult> {
  let canonicalObserved: readonly AssignmentRecipientProjection[] | null = null;
  let fallbackUsed = false;
  let legacyObserved: readonly AssignmentRecipientProjection[] | null = null;
  let recipients: readonly AssignmentRecipientProjection[];
  let returnedAuthority: "CANONICAL" | "LEGACY";
  let shadowErrorCount = 0;

  if (input.mode === "LEGACY_ONLY") {
    recipients = freezeRecipients(await input.source.loadLegacy());
    legacyObserved = recipients;
    returnedAuthority = "LEGACY";
  } else if (input.mode === "LEGACY_PRIMARY_CANONICAL_SHADOW") {
    recipients = freezeRecipients(await input.source.loadLegacy());
    legacyObserved = recipients;
    returnedAuthority = "LEGACY";
    try {
      canonicalObserved = freezeRecipients(await input.source.loadCanonical());
    } catch {
      shadowErrorCount = 1;
    }
  } else {
    try {
      recipients = freezeRecipients(await input.source.loadCanonical());
      canonicalObserved = recipients;
      returnedAuthority = "CANONICAL";
    } catch (error: unknown) {
      if (
        input.mode !== "CANONICAL_PRIMARY_LEGACY_FALLBACK" ||
        !(error instanceof SubmissionSelfSourceError) ||
        error.failure !== "RUNTIME"
      ) {
        throw error;
      }
      recipients = freezeRecipients(await input.source.loadLegacy());
      legacyObserved = recipients;
      returnedAuthority = "LEGACY";
      fallbackUsed = true;
    }
  }

  const canonicalCount = recipients.filter(
    (recipient) => recipient.canonical_student_id !== null,
  ).length;
  const canonicalAssignmentIds = new Set(
    (canonicalObserved ?? []).map((recipient) => recipient.assignment_id),
  );
  const legacyAssignmentIds = new Set(
    (legacyObserved ?? []).map((recipient) => recipient.assignment_id),
  );
  const comparisonAvailable =
    canonicalObserved !== null && legacyObserved !== null;
  const matchedIdentityCount = comparisonAvailable
    ? [...canonicalAssignmentIds].filter((id) => legacyAssignmentIds.has(id))
        .length
    : 0;
  const canonicalOnlyCount = comparisonAvailable
    ? [...canonicalAssignmentIds].filter((id) => !legacyAssignmentIds.has(id))
        .length
    : 0;
  const legacyOnlyCount = comparisonAvailable
    ? [...legacyAssignmentIds].filter((id) => !canonicalAssignmentIds.has(id))
        .length
    : 0;
  const result = Object.freeze({
    fallbackUsed,
    recipients,
    returnedAuthority,
    shadowErrorCount,
    version: SUBMISSION_SELF_RESOLUTION_VERSION,
  });
  input.observer.record(
    Object.freeze({
      action: input.action,
      assignmentId: input.assignmentId,
      canonicalOnlyCount,
      canonicalSelfResolutionSuccess: canonicalCount > 0 ? 1 : 0,
      correlationId: input.correlationId,
      fallbackCount: fallbackUsed ? 1 : 0,
      legacyOnlyCount,
      legacySelfResolutionSuccess:
        legacyObserved !== null && legacyObserved.length > 0 ? 1 : 0,
      linkState: canonicalCount > 0 ? "ACTIVE" : "UNKNOWN",
      matchedIdentityCount,
      mode: input.mode,
      organizationId: input.organizationId,
      recipientFound: recipients.length > 0,
      recipientMismatch: canonicalOnlyCount + legacyOnlyCount,
      returnedAuthority,
      shadowErrorCount,
      tenantMismatch: 0,
      unexpectedIdentityConflict: 0,
      version: SUBMISSION_SELF_RESOLUTION_VERSION,
      writeFallbackCount: 0,
    }),
  );
  return result;
}

export function requireCanonicalSubmissionIdentity(input: {
  readonly activeOrganizationId: string;
  readonly resolution: CanonicalResolutionInput;
}): CanonicalSubmissionIdentity {
  const { resolution } = input;
  if (resolution.outcome === "linked") {
    if (resolution.organizationId !== input.activeOrganizationId) {
      throw new SubmissionSelfResolutionError("cross_tenant_forbidden");
    }
    return Object.freeze({
      linkId: resolution.linkId,
      organizationId: resolution.organizationId,
      studentId: resolution.studentId,
    });
  }

  switch (resolution.outcome) {
    case "ambiguous_link":
      throw new SubmissionSelfResolutionError("student_identity_conflict");
    case "expired_link":
      throw new SubmissionSelfResolutionError("student_account_link_expired");
    case "revoked_link":
      throw new SubmissionSelfResolutionError("student_account_link_inactive");
    case "wrong_organization":
      throw new SubmissionSelfResolutionError("cross_tenant_forbidden");
    case "inactive_context":
      throw new SubmissionSelfResolutionError(
        "submission_identity_unavailable",
      );
    case "no_link":
      throw new SubmissionSelfResolutionError("student_account_link_missing");
  }
}

export const submissionSelfResolutionVersion =
  SUBMISSION_SELF_RESOLUTION_VERSION;
