import {
  analyzeEnrollmentParity,
  executeDeterministicEnrollmentBackfill,
} from "@/lib/learner-convergence/application/enrollment-parity";
import type { CanonicalEnrollmentBackfillGateway } from "@/lib/learner-convergence/interfaces/backfill-gateway";

const organizationId = "10000000-0000-4000-8000-000000000001";
const otherOrganizationId = "10000000-0000-4000-8000-000000000002";
const studentId = "20000000-0000-4000-8000-000000000001";
const accountId = "30000000-0000-4000-8000-000000000001";
const classId = "40000000-0000-4000-8000-000000000001";
const linkId = "50000000-0000-4000-8000-000000000001";
const legacyEnrollmentId = "60000000-0000-4000-8000-000000000001";
const membershipId = "70000000-0000-4000-8000-000000000001";
const correlationId = "80000000-0000-4000-8000-000000000001";

function input(legacyStatus: "active" | "inactive" | "left" = "active") {
  return {
    authoritativeLinks: [{ accountId, linkId, organizationId, studentId }],
    canonicalEnrollments: [
      {
        classId,
        membershipId,
        organizationId,
        status:
          legacyStatus === "left" ? ("left" as const) : ("active" as const),
        studentId,
      },
    ],
    legacyEnrollments: [
      {
        accountId,
        classId,
        enrollmentId: legacyEnrollmentId,
        organizationId,
        status: legacyStatus,
      },
    ],
    managedAccountlessStudentIds: [],
    organizationId,
  };
}

describe("LE-001 Phase 3 enrollment parity", () => {
  it.each(["active", "left"] as const)(
    "maps legacy %s only to its deterministic canonical state",
    (status) => {
      const report = analyzeEnrollmentParity(input(status));
      expect(report.items[0]).toMatchObject({ classification: "PARITY_MATCH" });
      expect(report.summary.parity_match).toBe(1);
    },
  );

  it("reports legacy inactive as a status mismatch", () => {
    const report = analyzeEnrollmentParity(input("inactive"));
    expect(report.items).toEqual([
      expect.objectContaining({
        canonicalMembershipId: membershipId,
        classification: "STATUS_MISMATCH",
      }),
    ]);
    expect(report.summary.status_mismatch).toBe(1);
  });

  it("classifies a deterministic legacy-only enrollment for canonical backfill", () => {
    const report = analyzeEnrollmentParity({
      ...input(),
      canonicalEnrollments: [],
    });
    expect(report.items[0]).toMatchObject({
      canonicalStatus: "active",
      classification: "LEGACY_ONLY",
      studentId,
    });
  });

  it("keeps canonical-only managed/accountless enrollment out of legacy", () => {
    const report = analyzeEnrollmentParity({
      ...input(),
      authoritativeLinks: [],
      legacyEnrollments: [],
      managedAccountlessStudentIds: [studentId],
    });
    expect(report.items[0]).toMatchObject({
      canonicalOnlyReview: "expected_managed_accountless",
      classification: "IDENTITY_UNRESOLVED",
    });
    expect(report.summary.canonical_only).toBe(1);
  });

  it("reports canonical enrollment identity as unresolved without authority", () => {
    const report = analyzeEnrollmentParity({
      ...input(),
      authoritativeLinks: [],
      legacyEnrollments: [],
    });
    expect(report.items[0]).toMatchObject({
      canonicalOnlyReview: "identity_unresolved",
      classification: "IDENTITY_UNRESOLVED",
    });
  });

  it("rejects a cross-tenant enrollment", () => {
    const report = analyzeEnrollmentParity({
      ...input(),
      legacyEnrollments: [
        {
          ...input().legacyEnrollments[0],
          organizationId: otherOrganizationId,
        },
      ],
    });
    expect(report.items).toContainEqual(
      expect.objectContaining({ classification: "TENANT_MISMATCH" }),
    );
  });

  it("rejects cross-tenant learner identity for a scoped enrollment", () => {
    const report = analyzeEnrollmentParity({
      ...input(),
      authoritativeLinks: [
        { accountId, linkId, organizationId: otherOrganizationId, studentId },
      ],
    });
    expect(report.items).toContainEqual(
      expect.objectContaining({ classification: "TENANT_MISMATCH" }),
    );
  });

  it("does not mutate during enrollment dry-run", async () => {
    const plan = analyzeEnrollmentParity({
      ...input(),
      canonicalEnrollments: [],
    });
    const gateway: CanonicalEnrollmentBackfillGateway = {
      createCanonicalEnrollment: vi.fn(),
      loadCanonicalEnrollments: vi.fn(),
    };
    await expect(
      executeDeterministicEnrollmentBackfill({
        correlationIds: { [legacyEnrollmentId]: correlationId },
        dryRun: true,
        gateway,
        joinedAtByLegacyEnrollment: {
          [legacyEnrollmentId]: "2026-08-18T00:00:00.000Z",
        },
        plan,
      }),
    ).resolves.toEqual([]);
    expect(gateway.createCanonicalEnrollment).not.toHaveBeenCalled();
  });

  it("creates once and is idempotent on rerun", async () => {
    const plan = analyzeEnrollmentParity({
      ...input(),
      canonicalEnrollments: [],
    });
    const gateway: CanonicalEnrollmentBackfillGateway = {
      createCanonicalEnrollment: vi.fn(async () => ({
        canonicalMembershipId: membershipId,
        correlationId,
      })),
      loadCanonicalEnrollments: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { membershipId, organizationId, status: "active", studentId },
        ]),
    };
    const request = {
      correlationIds: { [legacyEnrollmentId]: correlationId },
      dryRun: false,
      gateway,
      joinedAtByLegacyEnrollment: {
        [legacyEnrollmentId]: "2026-08-18T00:00:00.000Z",
      },
      plan,
    } as const;

    await expect(
      executeDeterministicEnrollmentBackfill(request),
    ).resolves.toEqual([expect.objectContaining({ outcome: "created" })]);
    await expect(
      executeDeterministicEnrollmentBackfill(request),
    ).resolves.toEqual([expect.objectContaining({ outcome: "idempotent" })]);
    expect(gateway.createCanonicalEnrollment).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite a canonical enrollment with a conflicting status", async () => {
    const plan = analyzeEnrollmentParity({
      ...input(),
      canonicalEnrollments: [],
    });
    const gateway: CanonicalEnrollmentBackfillGateway = {
      createCanonicalEnrollment: vi.fn(),
      loadCanonicalEnrollments: vi.fn(async () => [
        {
          membershipId,
          organizationId,
          status: "left" as const,
          studentId,
        },
      ]),
    };

    await expect(
      executeDeterministicEnrollmentBackfill({
        correlationIds: { [legacyEnrollmentId]: correlationId },
        dryRun: false,
        gateway,
        joinedAtByLegacyEnrollment: {
          [legacyEnrollmentId]: "2026-08-18T00:00:00.000Z",
        },
        plan,
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        outcome: "blocked",
        reasonCode: "enrollment_conflict",
      }),
    ]);
    expect(gateway.createCanonicalEnrollment).not.toHaveBeenCalled();
  });
});
