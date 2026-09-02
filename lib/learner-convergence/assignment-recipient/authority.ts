import {
  ASSIGNMENT_RECIPIENT_AUTHORITY_VERSION,
  AssignmentRecipientSourceError,
  type AssignmentRecipientAuthorityObserver,
  type AssignmentRecipientAuthorityResult,
  type AssignmentRecipientProjection,
  type AssignmentRecipientSource,
  type AssignmentRecipientWriteAuthority,
} from "@/lib/learner-convergence/assignment-recipient/domain";
import {
  LEARNER_CUTOVER_CONTROL_MODES,
  type LearnerCutoverControlMode,
} from "@/lib/learner-convergence/cutover/domain";

export function resolveAssignmentRecipientAuthorityMode(input: {
  readonly configuredMode?: string;
  readonly selectedMode: LearnerCutoverControlMode;
}): LearnerCutoverControlMode {
  if (!input.configuredMode?.trim()) return input.selectedMode;
  const normalized = input.configuredMode.trim();
  return LEARNER_CUTOVER_CONTROL_MODES.some((mode) => mode === normalized)
    ? (normalized as LearnerCutoverControlMode)
    : "LEGACY_ONLY";
}

export function resolveAssignmentRecipientWriteAuthority(
  mode: LearnerCutoverControlMode,
): AssignmentRecipientWriteAuthority {
  switch (mode) {
    case "CANONICAL_ONLY":
      return "CANONICAL_ONLY";
    case "CANONICAL_PRIMARY_LEGACY_FALLBACK":
      return "CANONICAL_WITH_VERIFIED_LEGACY_PROJECTION";
    case "LEGACY_ONLY":
    case "LEGACY_PRIMARY_CANONICAL_SHADOW":
      return "LEGACY";
  }
}

function freezeProjection(
  recipients: readonly AssignmentRecipientProjection[],
): readonly AssignmentRecipientProjection[] {
  return Object.freeze(
    recipients.map((recipient) =>
      Object.freeze({
        ...recipient,
        source_class_ids: Object.freeze([...recipient.source_class_ids]),
      }),
    ),
  );
}

function metrics(recipients: readonly AssignmentRecipientProjection[]) {
  return {
    canonicalOnlyCount: recipients.filter(
      (recipient) => recipient.identity_authority === "CANONICAL",
    ).length,
    canonicalRecipientCount: recipients.filter(
      (recipient) => recipient.canonical_student_id !== null,
    ).length,
    compatibilityMappedCount: recipients.filter(
      (recipient) =>
        recipient.identity_authority === "CANONICAL_WITH_LEGACY_COMPATIBILITY",
    ).length,
    identityUnresolvedCount: recipients.filter(
      (recipient) => recipient.identity_authority === "LEGACY_ONLY_HISTORICAL",
    ).length,
    legacyHistoricalCount: recipients.filter(
      (recipient) => recipient.identity_authority === "LEGACY_ONLY_HISTORICAL",
    ).length,
  };
}

export async function readAssignmentRecipientsByAuthority(input: {
  readonly assignmentId: string;
  readonly correlationId: string;
  readonly mode: LearnerCutoverControlMode;
  readonly observer: AssignmentRecipientAuthorityObserver;
  readonly organizationId: string;
  readonly source: AssignmentRecipientSource;
}): Promise<AssignmentRecipientAuthorityResult> {
  let fallbackUsed = false;
  let recipients: readonly AssignmentRecipientProjection[];
  let returnedAuthority: "CANONICAL" | "LEGACY";
  let shadowErrorCount = 0;

  if (input.mode === "LEGACY_ONLY") {
    recipients = freezeProjection(await input.source.loadLegacy());
    returnedAuthority = "LEGACY";
  } else if (input.mode === "LEGACY_PRIMARY_CANONICAL_SHADOW") {
    recipients = freezeProjection(await input.source.loadLegacy());
    returnedAuthority = "LEGACY";
    try {
      await input.source.loadCanonical();
    } catch {
      shadowErrorCount = 1;
    }
  } else {
    try {
      recipients = freezeProjection(await input.source.loadCanonical());
      returnedAuthority = "CANONICAL";
    } catch (error: unknown) {
      if (
        input.mode !== "CANONICAL_PRIMARY_LEGACY_FALLBACK" ||
        !(error instanceof AssignmentRecipientSourceError) ||
        error.failure !== "RUNTIME"
      ) {
        throw error;
      }
      recipients = freezeProjection(await input.source.loadLegacy());
      returnedAuthority = "LEGACY";
      fallbackUsed = true;
    }
  }

  const counts = metrics(recipients);
  const result: AssignmentRecipientAuthorityResult = Object.freeze({
    fallbackUsed,
    mode: input.mode,
    recipients,
    returnedAuthority,
    shadowErrorCount,
    version: ASSIGNMENT_RECIPIENT_AUTHORITY_VERSION,
  });
  input.observer.record(
    Object.freeze({
      assignmentId: input.assignmentId,
      ...counts,
      correlationId: input.correlationId,
      fallbackUsed,
      mode: input.mode,
      organizationId: input.organizationId,
      recipientCount: recipients.length,
      returnedAuthority,
      shadowErrorCount,
      version: ASSIGNMENT_RECIPIENT_AUTHORITY_VERSION,
      writeFallbackCount: 0,
    }),
  );
  return result;
}
