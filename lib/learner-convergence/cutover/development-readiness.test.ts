import { analyzeLearnerShadowSuite } from "@/lib/learner-convergence/shadow/analyze";
import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";
import { evaluatePhase4DevelopmentReadiness } from "@/lib/learner-convergence/cutover/development-readiness";

const organizationId = "00000000-0000-4000-8000-000000000001";
const classId = "00000000-0000-4000-8000-000000000002";

function developmentEvidence(): LearnerParitySnapshot {
  return {
    accountLinks: [],
    assignmentRecipients: [],
    asOf: "2026-08-19T00:00:00.000Z",
    canonicalEnrollments: [
      {
        classId,
        membershipId: "00000000-0000-4000-8000-000000000020",
        organizationId,
        status: "active",
        studentId: "00000000-0000-4000-8000-000000000010",
      },
      {
        classId,
        membershipId: "00000000-0000-4000-8000-000000000021",
        organizationId,
        status: "active",
        studentId: "00000000-0000-4000-8000-000000000011",
      },
    ],
    canonicalStudents: Array.from({ length: 8 }, (_, index) => ({
      accountAccessMode: "unspecified" as const,
      organizationId,
      status: "active" as const,
      studentId: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
    })),
    eligibleProfileStudents: [],
    guardianRelationships: [],
    learningEvents: [],
    legacyEnrollments: [],
    masteryRecords: [],
    organizationId,
    submissions: [],
    version: "le-001.v1",
  };
}

describe("LE-001 Phase 5 documented Development readiness", () => {
  it("uses Phase 4 evidence without promoting any consumer", () => {
    const phase4 = analyzeLearnerShadowSuite({
      adaptiveLegacyAccountIds: [],
      assignmentClassIds: [],
      snapshot: developmentEvidence(),
    });
    const readiness = evaluatePhase4DevelopmentReadiness(phase4);
    const byConsumer = new Map(
      readiness.map((result) => [result.consumer, result]),
    );

    expect(byConsumer.get("class_read_detail")?.readiness).toBe(
      "BLOCKED_SECURITY",
    );
    expect(byConsumer.get("teacher_dashboard")?.readiness).toBe(
      "BLOCKED_IDENTITY",
    );
    expect(byConsumer.get("reporting")?.readiness).toBe("BLOCKED_IDENTITY");
    for (const consumer of [
      "assignment_class_expansion",
      "assignment_recipients",
      "submission_self_resolution",
      "learning_events",
      "mastery_subject_projections",
      "adaptive_recommendations",
      "guardian_verification",
      "parent_portal",
    ] as const) {
      expect(byConsumer.get(consumer)?.readiness).toBe("NOT_READY");
      expect(byConsumer.get(consumer)?.blockingReasons).toContain(
        "NO_EVIDENCE_DATA",
      );
    }
    expect(
      readiness.every((result) =>
        [
          "BLOCKED_DATA",
          "BLOCKED_IDENTITY",
          "BLOCKED_SECURITY",
          "BLOCKED_STATUS_MAPPING",
          "NOT_READY",
        ].includes(result.readiness),
      ),
    ).toBe(true);
  });

  it("fails closed if a required Phase 4 consumer result is missing", () => {
    const phase4 = analyzeLearnerShadowSuite({
      snapshot: developmentEvidence(),
    });

    expect(() => evaluatePhase4DevelopmentReadiness(phase4.slice(1))).toThrow(
      "phase4_evidence_missing:class_read_detail",
    );
  });
});
