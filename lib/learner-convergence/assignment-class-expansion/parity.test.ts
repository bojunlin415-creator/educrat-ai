import { compareAssignmentClassExpansionAuthorities } from "@/lib/learner-convergence/assignment-class-expansion/parity";
import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";

const organizationId = "10000000-0000-4000-8000-000000000001";
const classId = "20000000-0000-4000-8000-000000000001";
const accountId = "30000000-0000-4000-8000-000000000001";
const studentId = "40000000-0000-4000-8000-000000000001";

function snapshot(
  overrides: Partial<LearnerParitySnapshot> = {},
): LearnerParitySnapshot {
  return {
    accountLinks: [],
    assignmentRecipients: [],
    asOf: "2026-08-20T00:00:00.000Z",
    canonicalEnrollments: [
      {
        classId,
        membershipId: "50000000-0000-4000-8000-000000000001",
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

describe("LE-001 Phase 5D Assignment class expansion parity", () => {
  it("treats an active managed canonical-only learner as expected", () => {
    expect(
      compareAssignmentClassExpansionAuthorities({
        classIds: [classId],
        snapshot: snapshot(),
      }),
    ).toMatchObject({
      canonicalCandidateCount: 1,
      compatibilityMappedCount: 0,
      expectedCanonicalOnlyCount: 1,
      identityUnresolvedCount: 1,
      legacyCandidateCount: 0,
      legacyOnlyCount: 0,
      matchCount: 0,
      shadowErrorCount: 0,
      statusMismatchCount: 0,
      tenantMismatchCount: 0,
      unexpectedCanonicalOnlyCount: 0,
    });
  });

  it("matches only through an active verified compatibility link", () => {
    const metrics = compareAssignmentClassExpansionAuthorities({
      classIds: [classId],
      snapshot: snapshot({
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
      }),
    });

    expect(metrics).toMatchObject({
      compatibilityMappedCount: 1,
      expectedCanonicalOnlyCount: 0,
      identityUnresolvedCount: 0,
      matchCount: 1,
    });
    expect(Object.isFrozen(metrics)).toBe(true);
  });

  it("excludes left and inactive memberships from current Assignment candidates", () => {
    const metrics = compareAssignmentClassExpansionAuthorities({
      classIds: [classId],
      snapshot: snapshot({
        canonicalEnrollments: [
          {
            classId,
            membershipId: "50000000-0000-4000-8000-000000000001",
            organizationId,
            status: "left",
            studentId,
          },
        ],
        legacyEnrollments: [
          {
            accountId,
            classId,
            enrollmentId: "70000000-0000-4000-8000-000000000001",
            organizationId,
            status: "inactive",
          },
        ],
      }),
    });

    expect(metrics).toMatchObject({
      canonicalCandidateCount: 0,
      identityUnresolvedCount: 0,
      legacyCandidateCount: 0,
    });
  });
});
