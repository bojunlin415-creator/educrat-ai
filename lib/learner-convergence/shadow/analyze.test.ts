import {
  analyzeLearnerShadowConsumer,
  analyzeLearnerShadowSuite,
} from "@/lib/learner-convergence/shadow/analyze";
import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";

const organizationId = "10000000-0000-4000-8000-000000000001";
const otherOrganizationId = "10000000-0000-4000-8000-000000000002";
const accountId = "20000000-0000-4000-8000-000000000001";
const studentId = "30000000-0000-4000-8000-000000000001";
const classId = "40000000-0000-4000-8000-000000000001";
const enrollmentId = "50000000-0000-4000-8000-000000000001";
const membershipId = "60000000-0000-4000-8000-000000000001";
const linkId = "70000000-0000-4000-8000-000000000001";
const assignmentId = "80000000-0000-4000-8000-000000000001";

function snapshot(
  overrides: Partial<LearnerParitySnapshot> = {},
): LearnerParitySnapshot {
  return {
    accountLinks: [],
    assignmentRecipients: [],
    asOf: "2026-08-18T08:00:00.000Z",
    canonicalEnrollments: [],
    canonicalStudents: [],
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

function activeStudentLink() {
  return {
    accountId,
    linkId,
    organizationId,
    status: "active" as const,
    studentId,
    validFrom: "2026-08-01T00:00:00.000Z",
    validTo: null,
  };
}

function canonicalStudent(status: "active" | "archived" = "active") {
  return {
    accountAccessMode: "link_expected" as const,
    organizationId,
    status,
    studentId,
  };
}

function legacyEnrollment(status: "active" | "inactive" | "left" = "active") {
  return { accountId, classId, enrollmentId, organizationId, status };
}

function canonicalEnrollment(status: "active" | "left" = "active") {
  return { classId, membershipId, organizationId, status, studentId };
}

describe("LE-001 Phase 4 consumer shadow analyzer", () => {
  it("classifies a linked equivalent class roster as parity ready", () => {
    const result = analyzeLearnerShadowConsumer({
      consumer: "class_read_detail",
      scope: { classIds: [classId] },
      snapshot: snapshot({
        accountLinks: [activeStudentLink()],
        canonicalEnrollments: [canonicalEnrollment()],
        canonicalStudents: [canonicalStudent()],
        legacyEnrollments: [legacyEnrollment()],
      }),
    });

    expect(result.summary).toMatchObject({
      parity_match: 1,
      parity_rate: 1,
      total_canonical_references: 1,
      total_legacy_references: 1,
    });
    expect(result.readiness).toBe("PARITY_READY");
    expect(result.discrepancies).toEqual([]);
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("classifies unresolved, legacy-only, canonical-only and ambiguous identities", () => {
    const unresolved = analyzeLearnerShadowConsumer({
      consumer: "class_read_detail",
      snapshot: snapshot({ legacyEnrollments: [legacyEnrollment()] }),
    });
    expect(unresolved.summary).toMatchObject({
      identity_unresolved: 1,
      legacy_only: 1,
    });
    expect(unresolved.readiness).toBe("BLOCKED_IDENTITY");

    const legacyOnly = analyzeLearnerShadowConsumer({
      consumer: "class_read_detail",
      snapshot: snapshot({
        accountLinks: [activeStudentLink()],
        canonicalStudents: [canonicalStudent()],
        legacyEnrollments: [legacyEnrollment()],
      }),
    });
    expect(legacyOnly.summary.legacy_only).toBe(1);
    expect(legacyOnly.readiness).toBe("BLOCKED_DATA");

    const canonicalOnly = analyzeLearnerShadowConsumer({
      consumer: "class_read_detail",
      snapshot: snapshot({
        accountLinks: [activeStudentLink()],
        canonicalEnrollments: [canonicalEnrollment()],
        canonicalStudents: [canonicalStudent()],
      }),
    });
    expect(canonicalOnly.summary.canonical_only).toBe(1);

    const ambiguous = analyzeLearnerShadowConsumer({
      consumer: "assignment_recipients",
      snapshot: snapshot({
        accountLinks: [
          activeStudentLink(),
          {
            ...activeStudentLink(),
            linkId: "70000000-0000-4000-8000-000000000002",
            studentId: "30000000-0000-4000-8000-000000000002",
          },
        ],
        assignmentRecipients: [{ accountId, assignmentId, organizationId }],
      }),
    });
    expect(ambiguous.summary.ambiguous).toBe(1);
    expect(ambiguous.readiness).toBe("BLOCKED_IDENTITY");
  });

  it("fails readiness for status, tenant and orphan reference mismatches", () => {
    const status = analyzeLearnerShadowConsumer({
      consumer: "class_read_detail",
      snapshot: snapshot({
        accountLinks: [activeStudentLink()],
        canonicalEnrollments: [canonicalEnrollment("left")],
        canonicalStudents: [canonicalStudent()],
        legacyEnrollments: [legacyEnrollment("active")],
      }),
    });
    expect(status.summary.status_mismatch).toBe(1);

    const tenant = analyzeLearnerShadowConsumer({
      consumer: "learning_events",
      snapshot: snapshot({
        learningEvents: [
          {
            accountId,
            eventId: "90000000-0000-4000-8000-000000000001",
            organizationId: otherOrganizationId,
          },
        ],
      }),
    });
    expect(tenant.summary.tenant_mismatch).toBe(1);
    expect(tenant.readiness).toBe("BLOCKED_SECURITY");

    const orphan = analyzeLearnerShadowConsumer({
      consumer: "submission_self_resolution",
      snapshot: snapshot({
        accountLinks: [activeStudentLink()],
        submissions: [
          {
            accountId,
            assignmentId,
            organizationId,
            submissionId: "90000000-0000-4000-8000-000000000002",
          },
        ],
      }),
    });
    expect(orphan.summary.orphan_reference).toBe(1);
    expect(orphan.readiness).toBe("BLOCKED_DATA");
  });

  it("covers all consumers in the approved rollout order", () => {
    const results = analyzeLearnerShadowSuite({
      adaptiveLegacyAccountIds: [accountId],
      assignmentClassIds: [classId],
      snapshot: snapshot({
        assignmentRecipients: [{ accountId, assignmentId, organizationId }],
        guardianRelationships: [
          {
            legacyStudentAccountId: accountId,
            organizationId,
            relationshipId: "90000000-0000-4000-8000-000000000003",
            status: "active",
          },
        ],
        learningEvents: [
          {
            accountId,
            eventId: "90000000-0000-4000-8000-000000000004",
            organizationId,
          },
        ],
        masteryRecords: [
          {
            accountId,
            organizationId,
            recordId: "90000000-0000-4000-8000-000000000005",
            recordType: "knowledge_mastery",
          },
        ],
        submissions: [
          {
            accountId,
            assignmentId,
            organizationId,
            submissionId: "90000000-0000-4000-8000-000000000006",
          },
        ],
      }),
    });

    expect(results.map((result) => result.consumer)).toEqual([
      "class_read_detail",
      "teacher_dashboard",
      "assignment_class_expansion",
      "assignment_recipients",
      "submission_self_resolution",
      "learning_events",
      "mastery_subject_projections",
      "adaptive_recommendations",
      "reporting",
      "guardian_parent_portal",
    ]);
    expect(results.every((result) => Object.isFrozen(result))).toBe(true);
  });

  it("does not fabricate data when a consumer has no records", () => {
    const result = analyzeLearnerShadowConsumer({
      consumer: "guardian_parent_portal",
      snapshot: snapshot(),
    });
    expect(result.dataStatus).toBe("NO_DATA");
    expect(result.readiness).toBe("NOT_READY");
    expect(result.summary.parity_rate).toBe(0);
  });

  it("treats an explicitly empty assignment class scope as no data", () => {
    const results = analyzeLearnerShadowSuite({
      snapshot: snapshot({
        canonicalEnrollments: [canonicalEnrollment()],
      }),
    });
    const expansion = results.find(
      (result) => result.consumer === "assignment_class_expansion",
    );

    expect(expansion).toMatchObject({
      dataStatus: "NO_DATA",
      readiness: "NOT_READY",
      summary: {
        total_canonical_references: 0,
        total_legacy_references: 0,
      },
    });
  });

  it("classifies every higher-risk consumer independently without fabricating identity", () => {
    const identitySnapshot = snapshot({
      assignmentRecipients: [{ accountId, assignmentId, organizationId }],
      canonicalEnrollments: [canonicalEnrollment()],
      guardianRelationships: [
        {
          legacyStudentAccountId: accountId,
          organizationId,
          relationshipId: "90000000-0000-4000-8000-000000000003",
          status: "active",
        },
      ],
      learningEvents: [
        {
          accountId,
          eventId: "90000000-0000-4000-8000-000000000004",
          organizationId,
        },
      ],
      masteryRecords: [
        {
          accountId,
          organizationId,
          recordId: "90000000-0000-4000-8000-000000000005",
          recordType: "knowledge_mastery",
        },
      ],
      submissions: [
        {
          accountId,
          assignmentId,
          organizationId,
          submissionId: "90000000-0000-4000-8000-000000000006",
        },
      ],
    });
    const checks = [
      analyzeLearnerShadowConsumer({
        consumer: "teacher_dashboard",
        snapshot: identitySnapshot,
      }),
      analyzeLearnerShadowConsumer({
        consumer: "assignment_class_expansion",
        scope: { classIds: [classId] },
        snapshot: identitySnapshot,
      }),
      analyzeLearnerShadowConsumer({
        consumer: "assignment_recipients",
        scope: { assignmentIds: [assignmentId] },
        snapshot: identitySnapshot,
      }),
      analyzeLearnerShadowConsumer({
        consumer: "submission_self_resolution",
        scope: { legacyAccountIds: [accountId] },
        snapshot: identitySnapshot,
      }),
      analyzeLearnerShadowConsumer({
        consumer: "learning_events",
        scope: { legacyAccountIds: [accountId] },
        snapshot: identitySnapshot,
      }),
      analyzeLearnerShadowConsumer({
        consumer: "mastery_subject_projections",
        scope: { legacyAccountIds: [accountId] },
        snapshot: identitySnapshot,
      }),
      analyzeLearnerShadowConsumer({
        consumer: "adaptive_recommendations",
        scope: { legacyAccountIds: [accountId] },
        snapshot: identitySnapshot,
      }),
      analyzeLearnerShadowConsumer({
        consumer: "reporting",
        scope: { legacyAccountIds: [accountId] },
        snapshot: identitySnapshot,
      }),
      analyzeLearnerShadowConsumer({
        consumer: "guardian_parent_portal",
        scope: { legacyAccountIds: [accountId] },
        snapshot: identitySnapshot,
      }),
    ];

    expect(checks.map((result) => result.consumer)).toEqual([
      "teacher_dashboard",
      "assignment_class_expansion",
      "assignment_recipients",
      "submission_self_resolution",
      "learning_events",
      "mastery_subject_projections",
      "adaptive_recommendations",
      "reporting",
      "guardian_parent_portal",
    ]);
    expect(
      checks.every(
        (result) =>
          result.readiness === "BLOCKED_IDENTITY" &&
          result.summary.identity_unresolved > 0,
      ),
    ).toBe(true);
  });
});
