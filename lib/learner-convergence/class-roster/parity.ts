import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";
import { mapLegacyEnrollmentStatus } from "@/lib/learner-convergence/domain/status-compatibility";
import {
  CLASS_ROSTER_CUTOVER_VERSION,
  type ClassRosterParityMetrics,
} from "@/lib/learner-convergence/class-roster/domain";

function isEffectiveLink(
  link: LearnerParitySnapshot["accountLinks"][number],
  asOf: number,
): boolean {
  return (
    link.status === "active" &&
    Date.parse(link.validFrom) <= asOf &&
    (link.validTo === null || Date.parse(link.validTo) > asOf)
  );
}

export function compareClassRosterAuthorities(input: {
  readonly classIds: readonly string[];
  readonly snapshot: LearnerParitySnapshot;
}): ClassRosterParityMetrics {
  const classIds = new Set(input.classIds);
  const legacy = input.snapshot.legacyEnrollments.filter((entry) =>
    classIds.has(entry.classId),
  );
  const canonical = input.snapshot.canonicalEnrollments.filter((entry) =>
    classIds.has(entry.classId),
  );
  const asOf = Date.parse(input.snapshot.asOf);
  const effectiveLinks = input.snapshot.accountLinks.filter((link) =>
    isEffectiveLink(link, asOf),
  );
  const linksByAccount = new Map<string, typeof effectiveLinks>();
  const linksByStudent = new Map<string, typeof effectiveLinks>();
  for (const link of effectiveLinks) {
    linksByAccount.set(link.accountId, [
      ...(linksByAccount.get(link.accountId) ?? []),
      link,
    ]);
    linksByStudent.set(link.studentId, [
      ...(linksByStudent.get(link.studentId) ?? []),
      link,
    ]);
  }
  const canonicalStudents = new Map(
    input.snapshot.canonicalStudents.map((student) => [
      student.studentId,
      student,
    ]),
  );
  const canonicalByPair = new Map(
    canonical.map((entry) => [`${entry.classId}:${entry.studentId}`, entry]),
  );
  const matchedCanonicalIds = new Set<string>();
  let expectedCanonicalOnlyManagedLearnerCount = 0;
  let identityConflictCount = 0;
  let legacyOnlyCount = 0;
  let matchCount = 0;
  let statusMismatchCount = 0;
  let tenantMismatchCount = 0;
  let unexpectedCanonicalOnlyCount = 0;

  for (const legacyEntry of legacy) {
    if (legacyEntry.organizationId !== input.snapshot.organizationId) {
      tenantMismatchCount += 1;
      legacyOnlyCount += 1;
      continue;
    }
    const links = linksByAccount.get(legacyEntry.accountId) ?? [];
    if (links.length !== 1) {
      identityConflictCount += 1;
      legacyOnlyCount += 1;
      continue;
    }
    const link = links[0];
    if (!link || link.organizationId !== input.snapshot.organizationId) {
      tenantMismatchCount += 1;
      legacyOnlyCount += 1;
      continue;
    }
    const canonicalEntry = canonicalByPair.get(
      `${legacyEntry.classId}:${link.studentId}`,
    );
    if (!canonicalEntry) {
      legacyOnlyCount += 1;
      continue;
    }
    matchedCanonicalIds.add(canonicalEntry.membershipId);
    const mapped = mapLegacyEnrollmentStatus(legacyEntry.status);
    if (
      !mapped.compatible ||
      mapped.canonicalStatus !== canonicalEntry.status
    ) {
      statusMismatchCount += 1;
      continue;
    }
    matchCount += 1;
  }

  for (const canonicalEntry of canonical) {
    if (canonicalEntry.organizationId !== input.snapshot.organizationId) {
      tenantMismatchCount += 1;
      unexpectedCanonicalOnlyCount += 1;
      continue;
    }
    if (matchedCanonicalIds.has(canonicalEntry.membershipId)) continue;
    const student = canonicalStudents.get(canonicalEntry.studentId);
    if (
      !student ||
      student.organizationId !== input.snapshot.organizationId ||
      (linksByStudent.get(canonicalEntry.studentId)?.length ?? 0) > 1
    ) {
      identityConflictCount += 1;
      unexpectedCanonicalOnlyCount += 1;
      continue;
    }
    if (canonicalEntry.status === "active" && student.status !== "active") {
      statusMismatchCount += 1;
      unexpectedCanonicalOnlyCount += 1;
      continue;
    }
    if ((linksByStudent.get(canonicalEntry.studentId)?.length ?? 0) === 0) {
      expectedCanonicalOnlyManagedLearnerCount += 1;
    } else {
      unexpectedCanonicalOnlyCount += 1;
    }
  }

  return Object.freeze({
    canonicalCount: canonical.length,
    expectedCanonicalOnlyManagedLearnerCount,
    identityConflictCount,
    legacyCount: legacy.length,
    legacyOnlyCount,
    matchCount,
    shadowErrorCount: 0,
    statusMismatchCount,
    tenantMismatchCount,
    unexpectedCanonicalOnlyCount,
    version: CLASS_ROSTER_CUTOVER_VERSION,
  });
}
