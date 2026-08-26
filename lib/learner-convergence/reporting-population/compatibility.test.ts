import type { ClassRosterStudentProjection } from "@/lib/learner-convergence/class-roster/domain";
import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";
import { resolveReportingMetricCompatibility } from "@/lib/learner-convergence/reporting-population/compatibility";
import { compareReportingPopulationAuthorities } from "@/lib/learner-convergence/reporting-population/parity";

const organizationId = "10000000-0000-4000-8000-000000000001";
const classId = "10000000-0000-4000-8000-000000000002";
const mappedStudentId = "10000000-0000-4000-8000-000000000003";
const managedStudentId = "10000000-0000-4000-8000-000000000004";
const accountId = "10000000-0000-4000-8000-000000000005";

const snapshot: LearnerParitySnapshot = Object.freeze({
  accountLinks: Object.freeze([
    Object.freeze({
      accountId,
      linkId: "10000000-0000-4000-8000-000000000006",
      organizationId,
      status: "active",
      studentId: mappedStudentId,
      validFrom: "2026-08-01T00:00:00.000Z",
      validTo: null,
    }),
  ]),
  assignmentRecipients: Object.freeze([]),
  asOf: "2026-08-26T00:00:00.000Z",
  canonicalEnrollments: Object.freeze([
    Object.freeze({
      classId,
      membershipId: "10000000-0000-4000-8000-000000000007",
      organizationId,
      status: "active",
      studentId: mappedStudentId,
    }),
    Object.freeze({
      classId,
      membershipId: "10000000-0000-4000-8000-000000000008",
      organizationId,
      status: "active",
      studentId: managedStudentId,
    }),
  ]),
  canonicalStudents: Object.freeze([
    Object.freeze({
      accountAccessMode: "link_expected",
      organizationId,
      status: "active",
      studentId: mappedStudentId,
    }),
    Object.freeze({
      accountAccessMode: "managed_accountless",
      organizationId,
      status: "active",
      studentId: managedStudentId,
    }),
  ]),
  eligibleProfileStudents: Object.freeze([
    Object.freeze({ accountId, organizationId, status: "active" }),
  ]),
  guardianRelationships: Object.freeze([]),
  learningEvents: Object.freeze([]),
  legacyEnrollments: Object.freeze([
    Object.freeze({
      accountId,
      classId,
      enrollmentId: "10000000-0000-4000-8000-000000000009",
      organizationId,
      status: "active",
    }),
  ]),
  masteryRecords: Object.freeze([]),
  organizationId,
  submissions: Object.freeze([]),
  version: "le-001.v1",
});

function entry(input: {
  readonly membershipId: string;
  readonly studentId: string;
}): ClassRosterStudentProjection {
  return Object.freeze({
    classId,
    englishName: null,
    grade: null,
    joinedAt: snapshot.asOf,
    leftAt: null,
    membershipId: input.membershipId,
    membershipStatus: "active",
    name: null,
    organizationId,
    studentId: input.studentId,
    studentNo: null,
    studentStatus: "active",
  });
}

describe("LE-001 Phase 5C Reporting metric compatibility", () => {
  it("maps only an effective verified Account link and exact same-class legacy enrollment", () => {
    const result = resolveReportingMetricCompatibility({
      entries: [
        entry({
          membershipId: snapshot.canonicalEnrollments[0]!.membershipId,
          studentId: mappedStudentId,
        }),
        entry({
          membershipId: snapshot.canonicalEnrollments[1]!.membershipId,
          studentId: managedStudentId,
        }),
      ],
      organizationId,
      snapshot,
    });

    expect(result).toEqual({
      canonicalLearnersWithoutLegacyMetrics: 1,
      identityUnresolvedCount: 1,
      references: [
        {
          canonicalStudentId: mappedStudentId,
          classId,
          legacyMetricStudentId: accountId,
        },
      ],
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.references[0])).toBe(true);
  });

  it("does not map by Student display attributes and fails cross-tenant input closed", () => {
    const withoutLinks = resolveReportingMetricCompatibility({
      entries: [
        entry({
          membershipId: snapshot.canonicalEnrollments[1]!.membershipId,
          studentId: managedStudentId,
        }),
      ],
      organizationId,
      snapshot,
    });
    expect(withoutLinks.references).toEqual([]);
    expect(withoutLinks.identityUnresolvedCount).toBe(1);

    expect(() =>
      resolveReportingMetricCompatibility({
        entries: [],
        organizationId: "10000000-0000-4000-8000-000000000099",
        snapshot,
      }),
    ).toThrow("reporting_metric_compatibility_tenant_mismatch");
  });

  it("classifies valid managed canonical-only population separately from mapped legacy metrics", () => {
    expect(
      compareReportingPopulationAuthorities({ classIds: [classId], snapshot }),
    ).toMatchObject({
      canonicalLearnersWithoutLegacyMetrics: 1,
      canonicalPopulationCount: 2,
      expectedCanonicalOnlyCount: 1,
      identityUnresolvedCount: 1,
      legacyOnlyCount: 0,
      legacyPopulationCount: 1,
      matchCount: 1,
      metricCompatibilityCount: 1,
      shadowErrorCount: 0,
      statusMismatchCount: 0,
      tenantMismatchCount: 0,
      unexpectedCanonicalOnlyCount: 0,
    });
  });

  it("excludes left historical memberships from current population parity", () => {
    const historicalSnapshot: LearnerParitySnapshot = Object.freeze({
      ...snapshot,
      canonicalEnrollments: Object.freeze(
        snapshot.canonicalEnrollments.map((enrollment) =>
          Object.freeze({ ...enrollment, status: "left" as const }),
        ),
      ),
      legacyEnrollments: Object.freeze(
        snapshot.legacyEnrollments.map((enrollment) =>
          Object.freeze({ ...enrollment, status: "left" as const }),
        ),
      ),
    });

    expect(
      compareReportingPopulationAuthorities({
        classIds: [classId],
        snapshot: historicalSnapshot,
      }),
    ).toMatchObject({
      canonicalPopulationCount: 0,
      identityUnresolvedCount: 0,
      legacyPopulationCount: 0,
      matchCount: 0,
      metricCompatibilityCount: 0,
    });
  });
});
