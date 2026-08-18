import { analyzeBackfillCandidates } from "@/lib/learner-convergence/application/backfill-candidates";
import { executeVerifiedLearnerBackfill } from "@/lib/learner-convergence/application/execute-backfill";
import type { LearnerAccountLinkBackfillGateway } from "@/lib/learner-convergence/interfaces/backfill-gateway";

const organizationId = "10000000-0000-4000-8000-000000000001";
const studentId = "20000000-0000-4000-8000-000000000001";
const accountId = "30000000-0000-4000-8000-000000000001";
const correlationId = "40000000-0000-4000-8000-000000000001";
const linkId = "60000000-0000-4000-8000-000000000001";

function plan() {
  return analyzeBackfillCandidates([
    {
      candidateAccountId: accountId,
      canonicalStudentId: studentId,
      correlationId,
      evidence: [
        {
          accountId,
          kind: "trusted_existing_mapping",
          organizationId,
          referenceId: "50000000-0000-4000-8000-000000000001",
          studentId,
        },
      ],
      existingActiveLinks: [],
      organizationId,
    },
  ]);
}

function gateway(): LearnerAccountLinkBackfillGateway {
  return {
    createMigrationVerifiedLink: vi.fn(async (input) => ({
      ...input,
      auditAction: "STUDENT_ACCOUNT_LINK_CREATED" as const,
      auditCorrelationId: input.correlationId,
      linkId,
      linkType: "migration_verified" as const,
    })),
    loadActiveLinks: vi.fn(async () => []),
  };
}

describe("LE-001 Phase 3 verified learner backfill", () => {
  it("performs no gateway operation during dry-run", async () => {
    const adapter = gateway();
    await expect(
      executeVerifiedLearnerBackfill({
        dryRun: true,
        gateway: adapter,
        plan: plan(),
      }),
    ).resolves.toEqual([]);
    expect(adapter.loadActiveLinks).not.toHaveBeenCalled();
    expect(adapter.createMigrationVerifiedLink).not.toHaveBeenCalled();
  });

  it("creates migration-verified provenance and verifies its audit receipt", async () => {
    const adapter = gateway();
    await expect(
      executeVerifiedLearnerBackfill({
        dryRun: false,
        gateway: adapter,
        plan: plan(),
      }),
    ).resolves.toEqual([
      expect.objectContaining({
        correlationId,
        linkId,
        outcome: "created",
      }),
    ]);
    expect(adapter.createMigrationVerifiedLink).toHaveBeenCalledWith({
      accountId,
      correlationId,
      organizationId,
      studentId,
    });
  });

  it("is idempotent when the exact active link already exists", async () => {
    const adapter = gateway();
    vi.mocked(adapter.loadActiveLinks).mockResolvedValue([
      { accountId, linkId, organizationId, studentId },
    ]);
    const result = await executeVerifiedLearnerBackfill({
      dryRun: false,
      gateway: adapter,
      plan: plan(),
    });

    expect(result[0]).toMatchObject({
      outcome: "idempotent",
      reasonCode: "already_linked",
    });
    expect(adapter.createMigrationVerifiedLink).not.toHaveBeenCalled();
  });

  it("blocks a conflicting active link without replacing authority", async () => {
    const adapter = gateway();
    vi.mocked(adapter.loadActiveLinks).mockResolvedValue([
      {
        accountId,
        linkId,
        organizationId,
        studentId: "20000000-0000-4000-8000-000000000002",
      },
    ]);
    const result = await executeVerifiedLearnerBackfill({
      dryRun: false,
      gateway: adapter,
      plan: plan(),
    });

    expect(result[0]).toMatchObject({
      outcome: "blocked",
      reasonCode: "active_link_conflict",
    });
    expect(adapter.createMigrationVerifiedLink).not.toHaveBeenCalled();
  });

  it("fails closed when the receipt does not prove audit correlation", async () => {
    const adapter = gateway();
    vi.mocked(adapter.createMigrationVerifiedLink).mockResolvedValue({
      accountId,
      auditAction: "STUDENT_ACCOUNT_LINK_CREATED",
      auditCorrelationId: "40000000-0000-4000-8000-000000000002",
      correlationId,
      linkId,
      linkType: "migration_verified",
      organizationId,
      studentId,
    });
    await expect(
      executeVerifiedLearnerBackfill({
        dryRun: false,
        gateway: adapter,
        plan: plan(),
      }),
    ).rejects.toThrow("invalid_backfill_receipt");
  });
});
