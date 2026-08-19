import { compareClassRosterAuthorities } from "@/lib/learner-convergence/class-roster/parity";
import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";

const organizationId = "10000000-0000-4000-8000-000000000001";
const otherOrganizationId = "10000000-0000-4000-8000-000000000002";
const classId = "20000000-0000-4000-8000-000000000001";
const accountId = "30000000-0000-4000-8000-000000000001";
const studentId = "40000000-0000-4000-8000-000000000001";
const membershipId = "50000000-0000-4000-8000-000000000001";

function snapshot(
  overrides: Partial<LearnerParitySnapshot> = {},
): LearnerParitySnapshot {
  return {
    accountLinks: [],
    assignmentRecipients: [],
    asOf: "2026-08-19T00:00:00.000Z",
    canonicalEnrollments: [
      {
        classId,
        membershipId,
        organizationId,
        status: "active",
        studentId,
      },
    ],
    canonicalStudents: [
      {
        accountAccessMode: "managed_accountless",
        organizationId,
        status: "active",
        studentId,
      },
    ],
    eligibleProfileStudents: [],
    guardianRelationships: [],
    learningEvents: [],
    legacyEnrollments: [],
    masteryRecords: [],
    organizationId,
    submissions: [],
    version: "le-001.v1",
    ...overrides,
  };
}

describe("LE-001 Phase 5A class roster parity", () => {
  it("classifies a valid canonical-only accountless learner as expected", () => {
    expect(
      compareClassRosterAuthorities({
        classIds: [classId],
        snapshot: snapshot(),
      }),
    ).toEqual({
      canonicalCount: 1,
      expectedCanonicalOnlyManagedLearnerCount: 1,
      identityConflictCount: 0,
      legacyCount: 0,
      legacyOnlyCount: 0,
      matchCount: 0,
      shadowErrorCount: 0,
      statusMismatchCount: 0,
      tenantMismatchCount: 0,
      unexpectedCanonicalOnlyCount: 0,
      version: "le-001.class-roster.v1",
    });
  });

  it("matches legacy and canonical membership only through one effective link", () => {
    const linked = snapshot({
      accountLinks: [
        {
          accountId,
          linkId: "60000000-0000-4000-8000-000000000001",
          organizationId,
          status: "active",
          studentId,
          validFrom: "2026-08-01T00:00:00.000Z",
          validTo: null,
        },
      ],
      legacyEnrollments: [
        {
          accountId,
          classId,
          enrollmentId: "70000000-0000-4000-8000-000000000001",
          organizationId,
          status: "active",
        },
      ],
    });

    expect(
      compareClassRosterAuthorities({ classIds: [classId], snapshot: linked }),
    ).toMatchObject({
      expectedCanonicalOnlyManagedLearnerCount: 0,
      legacyOnlyCount: 0,
      matchCount: 1,
      unexpectedCanonicalOnlyCount: 0,
    });
  });

  it("reports unresolved, tenant, and status conflicts fail closed", () => {
    const conflicted = snapshot({
      canonicalEnrollments: [
        {
          classId,
          membershipId,
          organizationId,
          status: "active",
          studentId,
        },
        {
          classId,
          membershipId: "50000000-0000-4000-8000-000000000002",
          organizationId: otherOrganizationId,
          status: "active",
          studentId: "40000000-0000-4000-8000-000000000002",
        },
      ],
      canonicalStudents: [
        {
          accountAccessMode: "managed_accountless",
          organizationId,
          status: "archived",
          studentId,
        },
      ],
    });

    expect(
      compareClassRosterAuthorities({
        classIds: [classId],
        snapshot: conflicted,
      }),
    ).toMatchObject({
      expectedCanonicalOnlyManagedLearnerCount: 0,
      statusMismatchCount: 1,
      tenantMismatchCount: 1,
      unexpectedCanonicalOnlyCount: 2,
    });
  });

  it("does not infer parity when an active link lacks a legacy enrollment", () => {
    const linkedWithoutLegacy = snapshot({
      accountLinks: [
        {
          accountId,
          linkId: "60000000-0000-4000-8000-000000000001",
          organizationId,
          status: "active",
          studentId,
          validFrom: "2026-08-01T00:00:00.000Z",
          validTo: null,
        },
      ],
    });

    expect(
      compareClassRosterAuthorities({
        classIds: [classId],
        snapshot: linkedWithoutLegacy,
      }),
    ).toMatchObject({
      expectedCanonicalOnlyManagedLearnerCount: 0,
      matchCount: 0,
      unexpectedCanonicalOnlyCount: 1,
    });
  });

  it("counts a legacy-only record without silently fabricating a learner link", () => {
    const legacyOnly = snapshot({
      canonicalEnrollments: [],
      canonicalStudents: [],
      legacyEnrollments: [
        {
          accountId,
          classId,
          enrollmentId: "70000000-0000-4000-8000-000000000001",
          organizationId,
          status: "active",
        },
      ],
    });

    expect(
      compareClassRosterAuthorities({
        classIds: [classId],
        snapshot: legacyOnly,
      }),
    ).toMatchObject({
      identityConflictCount: 1,
      legacyOnlyCount: 1,
      matchCount: 0,
    });
  });

  it("freezes aggregate evidence", () => {
    expect(
      Object.isFrozen(
        compareClassRosterAuthorities({
          classIds: [classId],
          snapshot: snapshot(),
        }),
      ),
    ).toBe(true);
  });
});
