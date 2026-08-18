import { analyzeLearnerEnrollmentParity } from "@/lib/learner-convergence/application/analyze-parity";
import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";

const organizationId = "10000000-0000-4000-8000-000000000001";
const otherOrganizationId = "10000000-0000-4000-8000-000000000002";
const accountId = "20000000-0000-4000-8000-000000000001";
const otherAccountId = "20000000-0000-4000-8000-000000000002";
const studentId = "30000000-0000-4000-8000-000000000001";
const otherStudentId = "30000000-0000-4000-8000-000000000002";
const classId = "40000000-0000-4000-8000-000000000001";

function snapshot(
  overrides: Partial<LearnerParitySnapshot> = {},
): LearnerParitySnapshot {
  return {
    accountLinks: [
      {
        accountId,
        linkId: "50000000-0000-4000-8000-000000000001",
        organizationId,
        status: "active",
        studentId,
        validFrom: "2026-08-01T00:00:00.000Z",
        validTo: null,
      },
    ],
    assignmentRecipients: [],
    asOf: "2026-08-18T00:00:00.000Z",
    canonicalEnrollments: [
      {
        classId,
        membershipId: "60000000-0000-4000-8000-000000000001",
        organizationId,
        status: "active",
        studentId,
      },
    ],
    canonicalStudents: [
      {
        accountAccessMode: "unspecified",
        organizationId,
        status: "active",
        studentId,
      },
    ],
    eligibleProfileStudents: [{ accountId, organizationId, status: "active" }],
    guardianRelationships: [],
    learningEvents: [],
    legacyEnrollments: [
      {
        accountId,
        classId,
        enrollmentId: "70000000-0000-4000-8000-000000000001",
        organizationId,
        status: "active",
      },
    ],
    masteryRecords: [],
    organizationId,
    submissions: [],
    version: "le-001.v1",
    ...overrides,
  };
}

describe("LE-001 learner and enrollment parity", () => {
  it("reports complete parity for one explicitly linked learner", () => {
    const report = analyzeLearnerEnrollmentParity(snapshot());

    expect(report.discrepancies).toEqual([]);
    expect(report.summary).toEqual({
      ambiguous_links: 0,
      canonical_active_enrollments: 1,
      canonical_only_enrollments: 0,
      canonical_students: 1,
      cross_tenant_mismatch_count: 0,
      eligible_profile_students: 1,
      enrollment_parity_rate: 1,
      legacy_active_enrollments: 1,
      legacy_only_enrollments: 0,
      linked_profile_students: 1,
      managed_students_without_account: 0,
      orphan_assignment_count: 0,
      orphan_guardian_count: 0,
      orphan_learning_event_count: 0,
      orphan_submission_count: 0,
      status_mismatch_count: 0,
    });
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.discrepancies)).toBe(true);
    expect(Object.isFrozen(report.summary)).toBe(true);
  });

  it("classifies a Student as managed only from an explicit accountless marker", () => {
    const report = analyzeLearnerEnrollmentParity(
      snapshot({
        accountLinks: [],
        canonicalEnrollments: [],
        canonicalStudents: [
          {
            accountAccessMode: "managed_accountless",
            organizationId,
            status: "active",
            studentId,
          },
        ],
        eligibleProfileStudents: [],
        legacyEnrollments: [],
      }),
    );

    expect(report.discrepancies).toContainEqual(
      expect.objectContaining({
        code: "managed_student_without_account",
        subjectId: studentId,
      }),
    );
    expect(report.summary.managed_students_without_account).toBe(1);
  });

  it("does not infer managed status when account intent is unspecified", () => {
    const report = analyzeLearnerEnrollmentParity(
      snapshot({
        accountLinks: [],
        canonicalEnrollments: [],
        eligibleProfileStudents: [],
        legacyEnrollments: [],
      }),
    );

    expect(report.discrepancies).toContainEqual(
      expect.objectContaining({
        code: "canonical_student_without_account_link",
        subjectId: studentId,
      }),
    );
    expect(report.summary.managed_students_without_account).toBe(0);
  });

  it("surfaces non-authoritative ambiguous candidates without creating a link", () => {
    const report = analyzeLearnerEnrollmentParity(
      snapshot({
        accountLinks: [],
        canonicalEnrollments: [
          {
            classId,
            membershipId: "60000000-0000-4000-8000-000000000001",
            organizationId,
            status: "active",
            studentId,
          },
          {
            classId,
            membershipId: "60000000-0000-4000-8000-000000000002",
            organizationId,
            status: "active",
            studentId: otherStudentId,
          },
        ],
        canonicalStudents: [
          {
            accountAccessMode: "unspecified",
            organizationId,
            status: "active",
            studentId,
          },
          {
            accountAccessMode: "unspecified",
            organizationId,
            status: "active",
            studentId: otherStudentId,
          },
        ],
      }),
    );

    expect(report.summary.ambiguous_links).toBeGreaterThan(0);
    expect(report.discrepancies).toContainEqual(
      expect.objectContaining({
        code: "ambiguous_account_student_match",
        subjectId: accountId,
      }),
    );
    expect(report.summary.linked_profile_students).toBe(0);
  });

  it("treats legacy inactive as an explicit unmapped status discrepancy", () => {
    const report = analyzeLearnerEnrollmentParity(
      snapshot({
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
    );

    expect(report.summary.status_mismatch_count).toBe(1);
    expect(report.discrepancies).toContainEqual(
      expect.objectContaining({ code: "enrollment_status_mismatch" }),
    );
  });

  it("reports legacy and canonical enrollment gaps independently", () => {
    const report = analyzeLearnerEnrollmentParity(
      snapshot({ accountLinks: [] }),
    );

    expect(report.summary.legacy_only_enrollments).toBe(1);
    expect(report.summary.canonical_only_enrollments).toBe(1);
    expect(report.summary.enrollment_parity_rate).toBe(0);
  });

  it("reports dependent legacy learner records without a verified canonical link", () => {
    const report = analyzeLearnerEnrollmentParity(
      snapshot({
        accountLinks: [],
        assignmentRecipients: [
          { accountId, assignmentId: classId, organizationId },
        ],
        guardianRelationships: [
          {
            legacyStudentAccountId: accountId,
            organizationId,
            relationshipId: "80000000-0000-4000-8000-000000000001",
            status: "active",
          },
        ],
        learningEvents: [
          {
            accountId,
            eventId: "90000000-0000-4000-8000-000000000001",
            organizationId,
          },
        ],
        masteryRecords: [
          {
            accountId,
            organizationId,
            recordId: "91000000-0000-4000-8000-000000000001",
            recordType: "knowledge_mastery",
          },
        ],
        submissions: [
          {
            accountId,
            assignmentId: classId,
            organizationId,
            submissionId: "92000000-0000-4000-8000-000000000001",
          },
        ],
      }),
    );
    const codes = new Set(report.discrepancies.map(({ code }) => code));

    for (const code of [
      "orphan_assignment_recipient",
      "orphan_submission_owner",
      "orphan_learning_event",
      "orphan_mastery_record",
      "orphan_guardian_relationship",
      "parent_portal_legacy_identity_dependency",
    ] as const) {
      expect(codes.has(code)).toBe(true);
    }
  });

  it("fails closed on cross-tenant records and unknown snapshot fields", () => {
    const report = analyzeLearnerEnrollmentParity(
      snapshot({
        eligibleProfileStudents: [
          {
            accountId: otherAccountId,
            organizationId: otherOrganizationId,
            status: "active",
          },
        ],
      }),
    );
    expect(report.summary.cross_tenant_mismatch_count).toBe(1);

    expect(() =>
      analyzeLearnerEnrollmentParity({ ...snapshot(), unexpected: true }),
    ).toThrow();
  });
});
