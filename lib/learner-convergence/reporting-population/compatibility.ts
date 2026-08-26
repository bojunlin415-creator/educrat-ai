import type { ClassRosterStudentProjection } from "@/lib/learner-convergence/class-roster/domain";
import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";
import type {
  ReportingMetricCompatibilityReference,
  ReportingMetricCompatibilityResult,
} from "@/lib/learner-convergence/reporting-population/domain";

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

function freezeResult(input: {
  readonly canonicalLearnersWithoutLegacyMetrics: number;
  readonly identityUnresolvedCount: number;
  readonly references: readonly ReportingMetricCompatibilityReference[];
}): ReportingMetricCompatibilityResult {
  return Object.freeze({
    ...input,
    references: Object.freeze(
      input.references.map((reference) => Object.freeze({ ...reference })),
    ),
  });
}

export function resolveReportingMetricCompatibility(input: {
  readonly entries: readonly ClassRosterStudentProjection[];
  readonly organizationId: string;
  readonly snapshot: LearnerParitySnapshot;
}): ReportingMetricCompatibilityResult {
  if (input.snapshot.organizationId !== input.organizationId) {
    throw new Error("reporting_metric_compatibility_tenant_mismatch");
  }

  const asOf = Date.parse(input.snapshot.asOf);
  if (!Number.isFinite(asOf)) {
    throw new Error("reporting_metric_compatibility_invalid_time");
  }

  const canonicalStudents = new Map(
    input.snapshot.canonicalStudents.map((student) => [
      student.studentId,
      student,
    ]),
  );
  const linksByStudent = new Map<
    string,
    LearnerParitySnapshot["accountLinks"]
  >();
  for (const link of input.snapshot.accountLinks.filter((candidate) =>
    isEffectiveLink(candidate, asOf),
  )) {
    linksByStudent.set(link.studentId, [
      ...(linksByStudent.get(link.studentId) ?? []),
      link,
    ]);
  }
  const legacyByClassAndAccount = new Map<
    string,
    LearnerParitySnapshot["legacyEnrollments"]
  >();
  for (const enrollment of input.snapshot.legacyEnrollments.filter(
    (candidate) => candidate.status === "active",
  )) {
    const key = `${enrollment.classId}:${enrollment.accountId}`;
    legacyByClassAndAccount.set(key, [
      ...(legacyByClassAndAccount.get(key) ?? []),
      enrollment,
    ]);
  }

  const references: ReportingMetricCompatibilityReference[] = [];
  let identityUnresolvedCount = 0;
  let canonicalLearnersWithoutLegacyMetrics = 0;

  for (const entry of input.entries) {
    if (
      entry.organizationId !== input.organizationId ||
      entry.studentId === null ||
      entry.studentStatus !== "active" ||
      entry.membershipStatus !== "active"
    ) {
      throw new Error("reporting_metric_compatibility_invalid_population");
    }
    const student = canonicalStudents.get(entry.studentId);
    if (
      !student ||
      student.organizationId !== input.organizationId ||
      student.status !== "active"
    ) {
      throw new Error("reporting_metric_compatibility_invalid_student");
    }
    const links = (linksByStudent.get(entry.studentId) ?? []).filter(
      (link) => link.organizationId === input.organizationId,
    );
    if (links.length !== 1) {
      identityUnresolvedCount += 1;
      canonicalLearnersWithoutLegacyMetrics += 1;
      continue;
    }
    const link = links[0];
    if (!link) {
      throw new Error("reporting_metric_compatibility_invalid_link");
    }
    const legacy = (
      legacyByClassAndAccount.get(`${entry.classId}:${link.accountId}`) ?? []
    ).filter(
      (enrollment) => enrollment.organizationId === input.organizationId,
    );
    if (legacy.length !== 1) {
      canonicalLearnersWithoutLegacyMetrics += 1;
      continue;
    }
    references.push({
      canonicalStudentId: entry.studentId,
      classId: entry.classId,
      legacyMetricStudentId: link.accountId,
    });
  }

  return freezeResult({
    canonicalLearnersWithoutLegacyMetrics,
    identityUnresolvedCount,
    references,
  });
}

export function unavailableReportingMetricCompatibility(
  entries: readonly ClassRosterStudentProjection[],
): ReportingMetricCompatibilityResult {
  return freezeResult({
    canonicalLearnersWithoutLegacyMetrics: entries.filter(
      (entry) => entry.studentId !== null,
    ).length,
    identityUnresolvedCount: entries.filter((entry) => entry.studentId !== null)
      .length,
    references: [],
  });
}
