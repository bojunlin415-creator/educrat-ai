import { z } from "zod";
import type {
  AccountLinkBackfillResult,
  LearnerBackfillPlan,
} from "@/lib/learner-convergence/domain/phase-3";
import type { LearnerAccountLinkBackfillGateway } from "@/lib/learner-convergence/interfaces/backfill-gateway";

const createdLinkSchema = z
  .object({
    accountId: z.string().uuid(),
    auditAction: z.literal("STUDENT_ACCOUNT_LINK_CREATED"),
    auditCorrelationId: z.string().uuid(),
    correlationId: z.string().uuid(),
    linkId: z.string().uuid(),
    linkType: z.literal("migration_verified"),
    organizationId: z.string().uuid(),
    studentId: z.string().uuid(),
  })
  .strict();

export async function executeVerifiedLearnerBackfill(input: {
  readonly dryRun: boolean;
  readonly gateway: LearnerAccountLinkBackfillGateway;
  readonly plan: LearnerBackfillPlan;
}): Promise<readonly AccountLinkBackfillResult[]> {
  if (!input.plan.safeToExecute) {
    throw new Error("backfill_safety_gate_failed");
  }

  const approved = input.plan.candidates.filter(
    (candidate) => candidate.classification === "DETERMINISTIC_VERIFIED",
  );
  if (input.dryRun) return Object.freeze([]);

  const results: AccountLinkBackfillResult[] = [];
  for (const candidate of approved) {
    if (candidate.candidateAccountId === null) {
      throw new Error("invalid_deterministic_candidate");
    }
    const activeLinks = await input.gateway.loadActiveLinks({
      accountId: candidate.candidateAccountId,
      organizationId: candidate.organizationId,
      studentId: candidate.canonicalStudentId,
    });
    const exact = activeLinks.filter(
      (link) =>
        link.organizationId === candidate.organizationId &&
        link.studentId === candidate.canonicalStudentId &&
        link.accountId === candidate.candidateAccountId,
    );
    const conflict = activeLinks.some(
      (link) =>
        link.organizationId === candidate.organizationId &&
        (link.studentId !== candidate.canonicalStudentId ||
          link.accountId !== candidate.candidateAccountId),
    );
    if (conflict || exact.length > 1) {
      results.push(
        Object.freeze({
          accountId: candidate.candidateAccountId,
          correlationId: candidate.correlationId,
          linkId: null,
          organizationId: candidate.organizationId,
          outcome: "blocked",
          reasonCode: "active_link_conflict",
          studentId: candidate.canonicalStudentId,
        }),
      );
      continue;
    }
    if (exact.length === 1) {
      results.push(
        Object.freeze({
          accountId: candidate.candidateAccountId,
          correlationId: candidate.correlationId,
          linkId: exact[0]?.linkId ?? null,
          organizationId: candidate.organizationId,
          outcome: "idempotent",
          reasonCode: "already_linked",
          studentId: candidate.canonicalStudentId,
        }),
      );
      continue;
    }

    const created = createdLinkSchema.parse(
      await input.gateway.createMigrationVerifiedLink({
        accountId: candidate.candidateAccountId,
        correlationId: candidate.correlationId,
        organizationId: candidate.organizationId,
        studentId: candidate.canonicalStudentId,
      }),
    );
    if (
      created.accountId !== candidate.candidateAccountId ||
      created.studentId !== candidate.canonicalStudentId ||
      created.organizationId !== candidate.organizationId ||
      created.correlationId !== candidate.correlationId ||
      created.auditCorrelationId !== candidate.correlationId
    ) {
      throw new Error("invalid_backfill_receipt");
    }
    results.push(
      Object.freeze({
        accountId: created.accountId,
        correlationId: created.correlationId,
        linkId: created.linkId,
        organizationId: created.organizationId,
        outcome: "created",
        reasonCode: "created",
        studentId: created.studentId,
      }),
    );
  }
  return Object.freeze(results);
}
