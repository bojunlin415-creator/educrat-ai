import { z } from "zod";
import {
  AUTHORITATIVE_IDENTITY_EVIDENCE_KINDS,
  type LearnerBackfillCandidate,
  type LearnerBackfillCandidateResult,
  type LearnerBackfillPlan,
} from "@/lib/learner-convergence/domain/phase-3";

const uuid = z.string().uuid();

const authoritativeEvidenceSchema = z
  .object({
    accountId: uuid,
    kind: z.enum(AUTHORITATIVE_IDENTITY_EVIDENCE_KINDS),
    organizationId: uuid,
    referenceId: uuid,
    studentId: uuid,
  })
  .strict();

const managedAccountlessEvidenceSchema = z
  .object({
    kind: z.literal("managed_accountless_marker"),
    organizationId: uuid,
    referenceId: uuid,
    studentId: uuid,
  })
  .strict();

const activeLinkSchema = z
  .object({
    accountId: uuid,
    linkId: uuid,
    organizationId: uuid,
    studentId: uuid,
  })
  .strict();

const learnerBackfillCandidateSchema = z
  .object({
    candidateAccountId: uuid.nullable(),
    canonicalStudentId: uuid,
    correlationId: uuid,
    evidence: z.array(
      z.discriminatedUnion("kind", [
        authoritativeEvidenceSchema,
        managedAccountlessEvidenceSchema,
      ]),
    ),
    existingActiveLinks: z.array(activeLinkSchema),
    organizationId: uuid,
  })
  .strict();

function freezeResult(
  result: LearnerBackfillCandidateResult,
): LearnerBackfillCandidateResult {
  return Object.freeze({ ...result });
}

export function classifyLearnerCandidate(
  input: unknown,
): LearnerBackfillCandidateResult {
  const candidate = learnerBackfillCandidateSchema.parse(
    input,
  ) as LearnerBackfillCandidate;
  const base = {
    candidateAccountId: candidate.candidateAccountId,
    canonicalStudentId: candidate.canonicalStudentId,
    correlationId: candidate.correlationId,
    organizationId: candidate.organizationId,
  } as const;

  const crossTenantEvidence = candidate.evidence.some(
    (evidence) => evidence.organizationId !== candidate.organizationId,
  );
  const crossTenantStudentLink = candidate.existingActiveLinks.some(
    (link) =>
      link.studentId === candidate.canonicalStudentId &&
      link.organizationId !== candidate.organizationId,
  );
  if (crossTenantEvidence || crossTenantStudentLink) {
    return freezeResult({
      ...base,
      classification: "CROSS_TENANT_INVALID",
      proposedAction: "NONE",
      reasonCode: "cross_tenant_identity_evidence",
    });
  }

  const authoritativeEvidence = candidate.evidence.filter(
    (evidence) => evidence.kind !== "managed_accountless_marker",
  );
  const managedEvidence = candidate.evidence.filter(
    (evidence) => evidence.kind === "managed_accountless_marker",
  );
  const conflictingLink = candidate.existingActiveLinks.some(
    (link) =>
      link.organizationId === candidate.organizationId &&
      (link.studentId === candidate.canonicalStudentId ||
        link.accountId === candidate.candidateAccountId) &&
      (link.studentId !== candidate.canonicalStudentId ||
        link.accountId !== candidate.candidateAccountId),
  );
  const conflictingEvidence = authoritativeEvidence.some(
    (evidence) =>
      evidence.organizationId === candidate.organizationId &&
      (evidence.studentId !== candidate.canonicalStudentId ||
        evidence.accountId !== candidate.candidateAccountId),
  );
  if (
    conflictingLink ||
    conflictingEvidence ||
    (managedEvidence.length > 0 &&
      (candidate.candidateAccountId !== null ||
        authoritativeEvidence.length > 0))
  ) {
    return freezeResult({
      ...base,
      classification: "AMBIGUOUS",
      proposedAction: "NONE",
      reasonCode: "competing_identity_authority",
    });
  }

  if (candidate.candidateAccountId === null) {
    if (
      managedEvidence.some(
        (evidence) =>
          evidence.organizationId === candidate.organizationId &&
          evidence.studentId === candidate.canonicalStudentId,
      )
    ) {
      return freezeResult({
        ...base,
        classification: "MANAGED_ACCOUNTLESS",
        proposedAction: "NONE",
        reasonCode: "managed_accountless_evidence",
      });
    }
    return freezeResult({
      ...base,
      classification: "NO_VALID_CANDIDATE",
      proposedAction: "NONE",
      reasonCode: "missing_authoritative_identity_evidence",
    });
  }

  const matchingEvidence = authoritativeEvidence.filter(
    (evidence) =>
      evidence.organizationId === candidate.organizationId &&
      evidence.studentId === candidate.canonicalStudentId &&
      evidence.accountId === candidate.candidateAccountId,
  );
  if (matchingEvidence.length === 0) {
    return freezeResult({
      ...base,
      classification: "NO_VALID_CANDIDATE",
      proposedAction: "NONE",
      reasonCode: "missing_authoritative_identity_evidence",
    });
  }

  return freezeResult({
    ...base,
    classification: "DETERMINISTIC_VERIFIED",
    proposedAction: "CREATE_ACTIVE_LINK",
    reasonCode: "authoritative_identity_verified",
  });
}

export function analyzeBackfillCandidates(
  inputs: readonly unknown[],
): LearnerBackfillPlan {
  const classified = inputs.map(classifyLearnerCandidate);
  const duplicateAccounts = new Set<string>();
  const duplicateStudents = new Set<string>();
  const seenAccounts = new Set<string>();
  const seenStudents = new Set<string>();
  const seenCorrelations = new Set<string>();

  for (const candidate of classified) {
    if (seenCorrelations.has(candidate.correlationId)) {
      throw new Error("duplicate_backfill_correlation_id");
    }
    seenCorrelations.add(candidate.correlationId);
    if (
      candidate.classification !== "DETERMINISTIC_VERIFIED" ||
      candidate.candidateAccountId === null
    ) {
      continue;
    }
    const accountKey = `${candidate.organizationId}:${candidate.candidateAccountId}`;
    const studentKey = `${candidate.organizationId}:${candidate.canonicalStudentId}`;
    if (seenAccounts.has(accountKey)) duplicateAccounts.add(accountKey);
    if (seenStudents.has(studentKey)) duplicateStudents.add(studentKey);
    seenAccounts.add(accountKey);
    seenStudents.add(studentKey);
  }

  const candidates = classified.map((candidate) => {
    const accountKey = `${candidate.organizationId}:${candidate.candidateAccountId ?? ""}`;
    const studentKey = `${candidate.organizationId}:${candidate.canonicalStudentId}`;
    if (
      candidate.classification === "DETERMINISTIC_VERIFIED" &&
      (duplicateAccounts.has(accountKey) || duplicateStudents.has(studentKey))
    ) {
      return freezeResult({
        ...candidate,
        classification: "AMBIGUOUS",
        proposedAction: "NONE",
        reasonCode: "competing_identity_authority",
      });
    }
    return candidate;
  });
  const count = (
    classification: LearnerBackfillCandidateResult["classification"],
  ) =>
    candidates.filter(
      (candidate) => candidate.classification === classification,
    ).length;
  const summary = Object.freeze({
    ambiguous: count("AMBIGUOUS"),
    cross_tenant_invalid: count("CROSS_TENANT_INVALID"),
    deterministic_verified: count("DETERMINISTIC_VERIFIED"),
    managed_accountless: count("MANAGED_ACCOUNTLESS"),
    no_valid_candidate: count("NO_VALID_CANDIDATE"),
  });

  return Object.freeze({
    candidates: Object.freeze(candidates),
    safeToExecute:
      summary.cross_tenant_invalid === 0 && summary.ambiguous === 0,
    summary,
  });
}
