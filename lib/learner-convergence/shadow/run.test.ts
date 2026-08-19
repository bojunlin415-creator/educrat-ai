import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";
import {
  runLearnerShadowObservation,
  preserveLegacyResult,
} from "@/lib/learner-convergence/shadow/run";

const organizationId = "10000000-0000-4000-8000-000000000001";

function emptySnapshot(): LearnerParitySnapshot {
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
  };
}

describe("LE-001 Phase 4 shadow runtime boundary", () => {
  it("does not query when the explicit feature control is disabled", async () => {
    const provider = { loadCurrentOrganizationSnapshot: vi.fn() };
    const sink = { record: vi.fn(), recordFailure: vi.fn() };

    await expect(
      runLearnerShadowObservation({
        consumer: "class_read_detail",
        correlationId: "correlation-1",
        enabled: false,
        organizationId,
        sink,
        snapshotProvider: provider,
      }),
    ).resolves.toEqual({ outcome: "DISABLED", result: null });
    expect(provider.loadCurrentOrganizationSnapshot).not.toHaveBeenCalled();
  });

  it("uses one batched snapshot load and records an aggregate result", async () => {
    const provider = {
      loadCurrentOrganizationSnapshot: vi
        .fn()
        .mockResolvedValue(emptySnapshot()),
    };
    const sink = { record: vi.fn(), recordFailure: vi.fn() };

    const observation = await runLearnerShadowObservation({
      consumer: "teacher_dashboard",
      correlationId: "correlation-2",
      enabled: true,
      organizationId,
      sink,
      snapshotProvider: provider,
    });

    expect(observation.outcome).toBe("COMPLETED");
    expect(provider.loadCurrentOrganizationSnapshot).toHaveBeenCalledTimes(1);
    expect(sink.record).toHaveBeenCalledTimes(1);
    expect(sink.recordFailure).not.toHaveBeenCalled();
  });

  it("fails shadow closed without throwing into the legacy consumer", async () => {
    const provider = {
      loadCurrentOrganizationSnapshot: vi
        .fn()
        .mockRejectedValue(
          Object.assign(new Error("private detail"), { code: "42501" }),
        ),
    };
    const sink = { record: vi.fn(), recordFailure: vi.fn() };

    await expect(
      runLearnerShadowObservation({
        consumer: "reporting",
        correlationId: "correlation-3",
        enabled: true,
        organizationId,
        sink,
        snapshotProvider: provider,
      }),
    ).resolves.toEqual({ outcome: "FAILED", result: null });
    expect(sink.recordFailure).toHaveBeenCalledWith({
      consumer: "reporting",
      correlationId: "correlation-3",
      organizationId,
      safeErrorCode: "42501",
    });
  });

  it("returns the exact legacy response even when shadow throws", async () => {
    const legacyResponse = Object.freeze({ rows: ["legacy-authority"] });
    const result = await preserveLegacyResult({
      legacyOperation: async () => legacyResponse,
      shadowOperation: async () => {
        throw new Error("shadow failed");
      },
    });
    expect(result).toBe(legacyResponse);
  });
});
