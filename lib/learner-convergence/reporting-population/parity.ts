import { compareClassRosterAuthorities } from "@/lib/learner-convergence/class-roster/parity";
import type { ClassRosterStudentProjection } from "@/lib/learner-convergence/class-roster/domain";
import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";
import { resolveReportingMetricCompatibility } from "@/lib/learner-convergence/reporting-population/compatibility";
import {
  REPORTING_POPULATION_VERSION,
  type ReportingPopulationParityMetrics,
} from "@/lib/learner-convergence/reporting-population/domain";

function canonicalEntries(input: {
  readonly classIds: ReadonlySet<string>;
  readonly snapshot: LearnerParitySnapshot;
}): readonly ClassRosterStudentProjection[] {
  const students = new Map(
    input.snapshot.canonicalStudents.map((student) => [
      student.studentId,
      student,
    ]),
  );
  return Object.freeze(
    input.snapshot.canonicalEnrollments
      .filter((entry) => {
        const student = students.get(entry.studentId);
        return (
          input.classIds.has(entry.classId) &&
          entry.status === "active" &&
          entry.organizationId === input.snapshot.organizationId &&
          student?.organizationId === input.snapshot.organizationId &&
          student.status === "active"
        );
      })
      .map((entry) => {
        const student = students.get(entry.studentId);
        return Object.freeze({
          classId: entry.classId,
          englishName: null,
          grade: null,
          joinedAt: input.snapshot.asOf,
          leftAt: null,
          membershipId: entry.membershipId,
          membershipStatus: "active" as const,
          name: null,
          organizationId: entry.organizationId,
          studentId: entry.studentId,
          studentNo: null,
          studentStatus: student?.status ?? null,
        });
      }),
  );
}

export function compareReportingPopulationAuthorities(input: {
  readonly classIds: readonly string[];
  readonly snapshot: LearnerParitySnapshot;
}): ReportingPopulationParityMetrics {
  const classIds = new Set(input.classIds);
  const currentSnapshot: LearnerParitySnapshot = Object.freeze({
    ...input.snapshot,
    canonicalEnrollments: Object.freeze(
      input.snapshot.canonicalEnrollments.filter(
        (entry) => entry.status === "active",
      ),
    ),
    legacyEnrollments: Object.freeze(
      input.snapshot.legacyEnrollments.filter(
        (entry) => entry.status === "active",
      ),
    ),
  });
  const roster = compareClassRosterAuthorities({
    classIds: input.classIds,
    snapshot: currentSnapshot,
  });
  const compatibility = resolveReportingMetricCompatibility({
    entries: canonicalEntries({ classIds, snapshot: currentSnapshot }),
    organizationId: input.snapshot.organizationId,
    snapshot: currentSnapshot,
  });
  return Object.freeze({
    canonicalLearnersWithoutLegacyMetrics:
      compatibility.canonicalLearnersWithoutLegacyMetrics,
    canonicalPopulationCount: roster.canonicalCount,
    expectedCanonicalOnlyCount: roster.expectedCanonicalOnlyManagedLearnerCount,
    identityUnresolvedCount: compatibility.identityUnresolvedCount,
    legacyOnlyCount: roster.legacyOnlyCount,
    legacyPopulationCount: roster.legacyCount,
    matchCount: roster.matchCount,
    metricCompatibilityCount: compatibility.references.length,
    shadowErrorCount: roster.shadowErrorCount,
    statusMismatchCount: roster.statusMismatchCount,
    tenantMismatchCount: roster.tenantMismatchCount,
    unexpectedCanonicalOnlyCount: roster.unexpectedCanonicalOnlyCount,
    version: REPORTING_POPULATION_VERSION,
  });
}
