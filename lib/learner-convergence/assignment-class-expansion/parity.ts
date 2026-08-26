import {
  ASSIGNMENT_CLASS_EXPANSION_VERSION,
  type AssignmentClassExpansionParityMetrics,
} from "@/lib/learner-convergence/assignment-class-expansion/domain";
import { compareClassRosterAuthorities } from "@/lib/learner-convergence/class-roster/parity";
import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";

export function compareAssignmentClassExpansionAuthorities(input: {
  readonly classIds: readonly string[];
  readonly snapshot: LearnerParitySnapshot;
}): AssignmentClassExpansionParityMetrics {
  const fullRoster = compareClassRosterAuthorities(input);
  const roster = compareClassRosterAuthorities({
    classIds: input.classIds,
    snapshot: {
      ...input.snapshot,
      canonicalEnrollments: input.snapshot.canonicalEnrollments.filter(
        (entry) => entry.status === "active",
      ),
      legacyEnrollments: input.snapshot.legacyEnrollments.filter(
        (entry) => entry.status === "active",
      ),
    },
  });
  return Object.freeze({
    canonicalCandidateCount: roster.canonicalCount,
    compatibilityMappedCount: roster.matchCount,
    expectedCanonicalOnlyCount: roster.expectedCanonicalOnlyManagedLearnerCount,
    identityUnresolvedCount:
      roster.expectedCanonicalOnlyManagedLearnerCount +
      roster.unexpectedCanonicalOnlyCount,
    legacyCandidateCount: roster.legacyCount,
    legacyOnlyCount: roster.legacyOnlyCount,
    matchCount: roster.matchCount,
    shadowErrorCount: roster.shadowErrorCount,
    statusMismatchCount: fullRoster.statusMismatchCount,
    tenantMismatchCount: fullRoster.tenantMismatchCount,
    unexpectedCanonicalOnlyCount: roster.unexpectedCanonicalOnlyCount,
    version: ASSIGNMENT_CLASS_EXPANSION_VERSION,
  });
}
