import {
  ASSIGNMENT_CLASS_EXPANSION_VERSION,
  type AssignmentClassExpansionAuthorityObserver,
  type AssignmentClassExpansionCandidate,
  type AssignmentClassExpansionReadResult,
  type AssignmentClassExpansionSource,
  type AssignmentRecipientCompatibilityResolver,
  type ExpandedAssignmentLearnerCandidate,
} from "@/lib/learner-convergence/assignment-class-expansion/domain";
import { isCanonicalRosterRuntimeFailure } from "@/lib/learner-convergence/class-roster/errors";
import {
  LEARNER_CUTOVER_CONTROL_MODES,
  type LearnerCutoverControlMode,
} from "@/lib/learner-convergence/cutover/domain";

export function resolveAssignmentClassExpansionAuthorityMode(input: {
  readonly configuredMode?: string;
  readonly selectedMode: LearnerCutoverControlMode;
}): LearnerCutoverControlMode {
  if (!input.configuredMode?.trim()) return input.selectedMode;
  const normalized = input.configuredMode.trim();
  return LEARNER_CUTOVER_CONTROL_MODES.some((mode) => mode === normalized)
    ? (normalized as LearnerCutoverControlMode)
    : "LEGACY_ONLY";
}

function deduplicate(
  entries: readonly AssignmentClassExpansionCandidate[],
  authority: "CANONICAL" | "LEGACY",
): readonly ExpandedAssignmentLearnerCandidate[] {
  const grouped = new Map<
    string,
    {
      canonicalStudentId: string | null;
      classIds: Set<string>;
      legacyRecipientId: string | null;
      membershipIds: Set<string>;
      organizationId: string;
    }
  >();
  for (const entry of entries) {
    if (entry.source !== authority) {
      throw new Error("assignment_class_expansion_source_mismatch");
    }
    const identity =
      authority === "CANONICAL"
        ? entry.canonicalStudentId
        : entry.legacyRecipientId;
    if (!identity) {
      throw new Error("assignment_class_expansion_identity_missing");
    }
    const current = grouped.get(identity);
    if (current && current.organizationId !== entry.organizationId) {
      throw new Error("assignment_class_expansion_tenant_mismatch");
    }
    const value = current ?? {
      canonicalStudentId: entry.canonicalStudentId,
      classIds: new Set<string>(),
      legacyRecipientId: entry.legacyRecipientId,
      membershipIds: new Set<string>(),
      organizationId: entry.organizationId,
    };
    value.classIds.add(entry.classId);
    value.membershipIds.add(entry.membershipId);
    grouped.set(identity, value);
  }
  return Object.freeze(
    [...grouped.values()].map((entry) =>
      Object.freeze({
        canonicalStudentId: entry.canonicalStudentId,
        classIds: Object.freeze([...entry.classIds].sort()),
        legacyRecipientId: entry.legacyRecipientId,
        membershipIds: Object.freeze([...entry.membershipIds].sort()),
        organizationId: entry.organizationId,
        source: authority,
      }),
    ),
  );
}

async function canonicalResult(input: {
  readonly entries: readonly AssignmentClassExpansionCandidate[];
  readonly compatibilityResolver: AssignmentRecipientCompatibilityResolver;
}): Promise<{
  readonly candidates: readonly ExpandedAssignmentLearnerCandidate[];
  readonly compatibilityMappedCount: number;
  readonly expectedAccountlessCandidateCount: number;
  readonly identityUnresolvedCount: number;
  readonly legacyRecipientIds: readonly string[];
}> {
  const candidates = deduplicate(input.entries, "CANONICAL");
  const canonicalStudentIds = candidates.map((entry) => {
    if (!entry.canonicalStudentId) {
      throw new Error("assignment_class_expansion_identity_missing");
    }
    return entry.canonicalStudentId;
  });
  const compatibility =
    await input.compatibilityResolver.resolve(canonicalStudentIds);
  const candidateIds = new Set(canonicalStudentIds);
  const mappedStudents = new Set<string>();
  const recipientIds = new Set<string>();
  for (const reference of compatibility.references) {
    if (
      !candidateIds.has(reference.canonicalStudentId) ||
      mappedStudents.has(reference.canonicalStudentId) ||
      recipientIds.has(reference.legacyRecipientId)
    ) {
      throw new Error("assignment_recipient_compatibility_invalid");
    }
    mappedStudents.add(reference.canonicalStudentId);
    recipientIds.add(reference.legacyRecipientId);
  }
  const expectedAccountless = new Set(
    compatibility.expectedAccountlessStudentIds,
  );
  if (
    [...expectedAccountless].some(
      (studentId) =>
        !candidateIds.has(studentId) || mappedStudents.has(studentId),
    )
  ) {
    throw new Error("assignment_recipient_compatibility_invalid");
  }
  return Object.freeze({
    candidates,
    compatibilityMappedCount: mappedStudents.size,
    expectedAccountlessCandidateCount: expectedAccountless.size,
    identityUnresolvedCount: candidates.length - mappedStudents.size,
    legacyRecipientIds: Object.freeze([...recipientIds].sort()),
  });
}

export async function readAssignmentClassExpansionByAuthority(input: {
  readonly actorRole: "organization_admin" | "organization_owner" | "teacher";
  readonly assignmentId: string | null;
  readonly classCount: number;
  readonly compatibilityResolver: AssignmentRecipientCompatibilityResolver;
  readonly correlationId: string;
  readonly mode: LearnerCutoverControlMode;
  readonly observer: AssignmentClassExpansionAuthorityObserver;
  readonly organizationId: string;
  readonly source: AssignmentClassExpansionSource;
}): Promise<AssignmentClassExpansionReadResult> {
  let authority: "CANONICAL" | "LEGACY";
  let candidates: readonly ExpandedAssignmentLearnerCandidate[];
  let canonicalCandidateCount: number | null = null;
  let compatibilityMappedCount = 0;
  let expectedAccountlessCandidateCount = 0;
  let fallbackUsed = false;
  let identityUnresolvedCount = 0;
  let legacyCandidateCount: number | null = null;
  let legacyRecipientIds: readonly string[] = Object.freeze([]);
  let shadowErrorCount = 0;

  if (input.mode === "LEGACY_ONLY") {
    candidates = deduplicate(await input.source.loadLegacy(), "LEGACY");
    authority = "LEGACY";
    legacyCandidateCount = candidates.length;
    legacyRecipientIds = Object.freeze(
      candidates.map((entry) => {
        if (!entry.legacyRecipientId) {
          throw new Error("assignment_class_expansion_identity_missing");
        }
        return entry.legacyRecipientId;
      }),
    );
  } else if (input.mode === "LEGACY_PRIMARY_CANONICAL_SHADOW") {
    candidates = deduplicate(await input.source.loadLegacy(), "LEGACY");
    authority = "LEGACY";
    legacyCandidateCount = candidates.length;
    legacyRecipientIds = Object.freeze(
      candidates.map((entry) => {
        if (!entry.legacyRecipientId) {
          throw new Error("assignment_class_expansion_identity_missing");
        }
        return entry.legacyRecipientId;
      }),
    );
    try {
      canonicalCandidateCount = deduplicate(
        await input.source.loadCanonical(),
        "CANONICAL",
      ).length;
    } catch {
      shadowErrorCount = 1;
    }
  } else {
    try {
      const canonical = await canonicalResult({
        compatibilityResolver: input.compatibilityResolver,
        entries: await input.source.loadCanonical(),
      });
      authority = "CANONICAL";
      candidates = canonical.candidates;
      canonicalCandidateCount = candidates.length;
      compatibilityMappedCount = canonical.compatibilityMappedCount;
      expectedAccountlessCandidateCount =
        canonical.expectedAccountlessCandidateCount;
      identityUnresolvedCount = canonical.identityUnresolvedCount;
      legacyRecipientIds = canonical.legacyRecipientIds;
    } catch (error: unknown) {
      if (
        input.mode !== "CANONICAL_PRIMARY_LEGACY_FALLBACK" ||
        !isCanonicalRosterRuntimeFailure(error)
      ) {
        throw error;
      }
      candidates = deduplicate(await input.source.loadLegacy(), "LEGACY");
      authority = "LEGACY";
      fallbackUsed = true;
      legacyCandidateCount = candidates.length;
      legacyRecipientIds = Object.freeze(
        candidates.map((entry) => {
          if (!entry.legacyRecipientId) {
            throw new Error("assignment_class_expansion_identity_missing");
          }
          return entry.legacyRecipientId;
        }),
      );
    }
  }

  const result: AssignmentClassExpansionReadResult = Object.freeze({
    authority,
    candidates,
    canonicalCandidateCount,
    compatibilityMappedCount,
    expectedAccountlessCandidateCount,
    fallbackUsed,
    identityUnresolvedCount,
    legacyCandidateCount,
    legacyRecipientIds,
    mode: input.mode,
    shadowErrorCount,
    version: ASSIGNMENT_CLASS_EXPANSION_VERSION,
  });
  input.observer.record(
    Object.freeze({
      actorRole: input.actorRole,
      assignmentId: input.assignmentId,
      canonicalCandidateCount,
      classCount: input.classCount,
      compatibilityMappedCount,
      correlationId: input.correlationId,
      expectedAccountlessCandidateCount,
      fallbackUsed,
      identityUnresolvedCount,
      legacyCandidateCount,
      mode: input.mode,
      organizationId: input.organizationId,
      returnedAuthority: authority,
      shadowErrorCount,
      version: ASSIGNMENT_CLASS_EXPANSION_VERSION,
    }),
  );
  return result;
}
