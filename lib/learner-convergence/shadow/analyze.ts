import { learnerParitySnapshotSchema } from "@/lib/learner-convergence/application/validation";
import type {
  CanonicalEnrollmentRecord,
  LearnerParitySnapshot,
  StudentAccountLinkRecord,
} from "@/lib/learner-convergence/domain/model";
import { mapLegacyEnrollmentStatus } from "@/lib/learner-convergence/domain/status-compatibility";
import {
  LEARNER_SHADOW_CONSUMERS,
  LEARNER_SHADOW_VERSION,
  type LearnerShadowConsumer,
  type LearnerShadowConsumerCheckInput,
  type LearnerShadowConsumerResult,
  type LearnerShadowDiscrepancy,
  type LearnerShadowReadiness,
  type LearnerShadowScope,
  type LearnerShadowSuiteInput,
  type LearnerShadowSummary,
} from "@/lib/learner-convergence/shadow/domain";

type MutableSummary = {
  -readonly [Key in keyof LearnerShadowSummary]: LearnerShadowSummary[Key];
};

function emptySummary(): MutableSummary {
  return {
    ambiguous: 0,
    canonical_only: 0,
    identity_unresolved: 0,
    legacy_only: 0,
    orphan_reference: 0,
    parity_match: 0,
    parity_rate: 0,
    shadow_error_count: 0,
    status_mismatch: 0,
    tenant_mismatch: 0,
    total_canonical_references: 0,
    total_legacy_references: 0,
  };
}

function isEffectiveLink(
  link: StudentAccountLinkRecord,
  asOf: number,
): boolean {
  return (
    link.status === "active" &&
    Date.parse(link.validFrom) <= asOf &&
    (link.validTo === null || Date.parse(link.validTo) > asOf)
  );
}

function normalizeScope(scope?: LearnerShadowScope) {
  return {
    assignmentIds: new Set(scope?.assignmentIds ?? []),
    classIds: new Set(scope?.classIds ?? []),
    legacyAccountIds: new Set(scope?.legacyAccountIds ?? []),
  };
}

function freezeDiscrepancy(
  value: LearnerShadowDiscrepancy,
): LearnerShadowDiscrepancy {
  return Object.freeze({ ...value });
}

function addDiscrepancy(
  discrepancies: LearnerShadowDiscrepancy[],
  value: LearnerShadowDiscrepancy,
): void {
  discrepancies.push(freezeDiscrepancy(value));
}

function incrementState(
  summary: MutableSummary,
  state: LearnerShadowDiscrepancy["parityState"],
): void {
  switch (state) {
    case "AMBIGUOUS_IDENTITY":
      summary.ambiguous += 1;
      break;
    case "CANONICAL_ONLY":
      summary.canonical_only += 1;
      break;
    case "IDENTITY_UNRESOLVED":
      summary.identity_unresolved += 1;
      break;
    case "LEGACY_ONLY":
      summary.legacy_only += 1;
      break;
    case "MISSING_REFERENCE":
    case "ORPHAN_REFERENCE":
      summary.orphan_reference += 1;
      break;
    case "STATUS_MISMATCH":
    case "UNSUPPORTED_LEGACY_STATE":
      summary.status_mismatch += 1;
      break;
    case "TENANT_MISMATCH":
      summary.tenant_mismatch += 1;
      break;
  }
}

function determineReadiness(
  summary: LearnerShadowSummary,
): LearnerShadowReadiness {
  if (summary.shadow_error_count > 0) return "NOT_READY";
  if (summary.tenant_mismatch > 0) return "BLOCKED_SECURITY";
  if (summary.ambiguous > 0 || summary.identity_unresolved > 0) {
    return "BLOCKED_IDENTITY";
  }
  if (
    summary.orphan_reference > 0 ||
    summary.status_mismatch > 0 ||
    summary.legacy_only > 0 ||
    summary.canonical_only > 0
  ) {
    return "BLOCKED_DATA";
  }
  if (
    summary.total_legacy_references === 0 &&
    summary.total_canonical_references === 0
  ) {
    return "NOT_READY";
  }
  return "PARITY_READY";
}

function finalize(
  consumer: LearnerShadowConsumer,
  organizationId: string,
  summary: MutableSummary,
  discrepancies: LearnerShadowDiscrepancy[],
): LearnerShadowConsumerResult {
  const denominator =
    summary.parity_match + summary.legacy_only + summary.canonical_only;
  summary.parity_rate =
    denominator === 0
      ? 0
      : Number((summary.parity_match / denominator).toFixed(4));
  const frozenSummary = Object.freeze({ ...summary });
  return Object.freeze({
    consumer,
    dataStatus:
      summary.total_legacy_references === 0 &&
      summary.total_canonical_references === 0
        ? "NO_DATA"
        : "HAS_DATA",
    discrepancies: Object.freeze(
      [...discrepancies].sort((left, right) =>
        `${left.parityState}:${left.legacyReference ?? ""}:${left.canonicalReference ?? ""}`.localeCompare(
          `${right.parityState}:${right.legacyReference ?? ""}:${right.canonicalReference ?? ""}`,
        ),
      ),
    ),
    organizationId,
    readiness: determineReadiness(frozenSummary),
    summary: frozenSummary,
    version: LEARNER_SHADOW_VERSION,
  });
}

function getActiveLinkMaps(snapshot: LearnerParitySnapshot) {
  const asOf = Date.parse(snapshot.asOf);
  const byAccount = new Map<string, StudentAccountLinkRecord[]>();
  const byStudent = new Map<string, StudentAccountLinkRecord[]>();
  for (const link of snapshot.accountLinks.filter((candidate) =>
    isEffectiveLink(candidate, asOf),
  )) {
    byAccount.set(link.accountId, [
      ...(byAccount.get(link.accountId) ?? []),
      link,
    ]);
    byStudent.set(link.studentId, [
      ...(byStudent.get(link.studentId) ?? []),
      link,
    ]);
  }
  return { byAccount, byStudent };
}

function compareIdentityReferences(input: {
  readonly consumer: LearnerShadowConsumer;
  readonly legacyReferences: readonly {
    readonly accountId: string;
    readonly organizationId: string;
    readonly referenceId: string;
  }[];
  readonly snapshot: LearnerParitySnapshot;
}): LearnerShadowConsumerResult {
  const { byAccount } = getActiveLinkMaps(input.snapshot);
  const canonicalById = new Map(
    input.snapshot.canonicalStudents
      .filter(
        (student) => student.organizationId === input.snapshot.organizationId,
      )
      .map((student) => [student.studentId, student]),
  );
  const summary = emptySummary();
  const discrepancies: LearnerShadowDiscrepancy[] = [];
  summary.total_legacy_references = input.legacyReferences.length;

  for (const reference of input.legacyReferences) {
    if (reference.organizationId !== input.snapshot.organizationId) {
      summary.legacy_only += 1;
      incrementState(summary, "TENANT_MISMATCH");
      addDiscrepancy(discrepancies, {
        canonicalReference: null,
        consumer: input.consumer,
        legacyReference: reference.referenceId,
        parityState: "TENANT_MISMATCH",
        reasonCode: "reference_outside_active_organization",
      });
      continue;
    }
    const links = byAccount.get(reference.accountId) ?? [];
    if (links.length === 0) {
      summary.legacy_only += 1;
      incrementState(summary, "IDENTITY_UNRESOLVED");
      addDiscrepancy(discrepancies, {
        canonicalReference: null,
        consumer: input.consumer,
        legacyReference: reference.referenceId,
        parityState: "IDENTITY_UNRESOLVED",
        reasonCode: "verified_account_link_missing",
      });
      continue;
    }
    if (links.length > 1) {
      summary.legacy_only += 1;
      incrementState(summary, "AMBIGUOUS_IDENTITY");
      addDiscrepancy(discrepancies, {
        canonicalReference: null,
        consumer: input.consumer,
        legacyReference: reference.referenceId,
        parityState: "AMBIGUOUS_IDENTITY",
        reasonCode: "multiple_effective_account_links",
      });
      continue;
    }
    const link = links[0];
    if (!link || link.organizationId !== input.snapshot.organizationId) {
      summary.legacy_only += 1;
      incrementState(summary, "TENANT_MISMATCH");
      addDiscrepancy(discrepancies, {
        canonicalReference: link?.studentId ?? null,
        consumer: input.consumer,
        legacyReference: reference.referenceId,
        parityState: "TENANT_MISMATCH",
        reasonCode: "account_link_tenant_mismatch",
      });
      continue;
    }
    const student = canonicalById.get(link.studentId);
    if (!student) {
      summary.legacy_only += 1;
      incrementState(summary, "MISSING_REFERENCE");
      addDiscrepancy(discrepancies, {
        canonicalReference: link.studentId,
        consumer: input.consumer,
        legacyReference: reference.referenceId,
        parityState: "MISSING_REFERENCE",
        reasonCode: "linked_canonical_student_missing",
      });
      continue;
    }
    if (student.status !== "active") {
      summary.total_canonical_references += 1;
      incrementState(summary, "STATUS_MISMATCH");
      addDiscrepancy(discrepancies, {
        canonicalReference: student.studentId,
        consumer: input.consumer,
        legacyReference: reference.referenceId,
        parityState: "STATUS_MISMATCH",
        reasonCode: "canonical_student_not_active",
      });
      continue;
    }
    summary.total_canonical_references += 1;
    summary.parity_match += 1;
  }

  return finalize(
    input.consumer,
    input.snapshot.organizationId,
    summary,
    discrepancies,
  );
}

function compareEnrollments(input: {
  readonly consumer: LearnerShadowConsumer;
  readonly scope: LearnerShadowScope | undefined;
  readonly snapshot: LearnerParitySnapshot;
}): LearnerShadowConsumerResult {
  const scope = normalizeScope(input.scope);
  const hasClassScope = input.scope?.classIds !== undefined;
  const hasAccountScope = input.scope?.legacyAccountIds !== undefined;
  const { byAccount, byStudent } = getActiveLinkMaps(input.snapshot);
  const scopedCanonicalStudentIds = new Set(
    [...scope.legacyAccountIds].flatMap((accountId) =>
      (byAccount.get(accountId) ?? []).map((link) => link.studentId),
    ),
  );
  const legacy = input.snapshot.legacyEnrollments.filter(
    (enrollment) =>
      (!hasClassScope || scope.classIds.has(enrollment.classId)) &&
      (!hasAccountScope || scope.legacyAccountIds.has(enrollment.accountId)),
  );
  const canonical = input.snapshot.canonicalEnrollments.filter(
    (enrollment) =>
      (!hasClassScope || scope.classIds.has(enrollment.classId)) &&
      (!hasAccountScope || scopedCanonicalStudentIds.has(enrollment.studentId)),
  );
  const canonicalByPair = new Map<string, CanonicalEnrollmentRecord>();
  for (const membership of canonical) {
    canonicalByPair.set(
      `${membership.classId}:${membership.studentId}`,
      membership,
    );
  }
  const matchedCanonical = new Set<string>();
  const summary = emptySummary();
  const discrepancies: LearnerShadowDiscrepancy[] = [];
  summary.total_legacy_references = legacy.length;
  summary.total_canonical_references = canonical.length;

  for (const enrollment of legacy) {
    if (enrollment.organizationId !== input.snapshot.organizationId) {
      summary.legacy_only += 1;
      incrementState(summary, "TENANT_MISMATCH");
      addDiscrepancy(discrepancies, {
        canonicalReference: null,
        consumer: input.consumer,
        legacyReference: enrollment.enrollmentId,
        parityState: "TENANT_MISMATCH",
        reasonCode: "legacy_enrollment_tenant_mismatch",
      });
      continue;
    }
    const links = byAccount.get(enrollment.accountId) ?? [];
    if (links.length === 0) {
      summary.legacy_only += 1;
      incrementState(summary, "IDENTITY_UNRESOLVED");
      addDiscrepancy(discrepancies, {
        canonicalReference: null,
        consumer: input.consumer,
        legacyReference: enrollment.enrollmentId,
        parityState: "IDENTITY_UNRESOLVED",
        reasonCode: "legacy_enrollment_account_link_missing",
      });
      continue;
    }
    if (links.length > 1) {
      summary.legacy_only += 1;
      incrementState(summary, "AMBIGUOUS_IDENTITY");
      addDiscrepancy(discrepancies, {
        canonicalReference: null,
        consumer: input.consumer,
        legacyReference: enrollment.enrollmentId,
        parityState: "AMBIGUOUS_IDENTITY",
        reasonCode: "legacy_enrollment_identity_ambiguous",
      });
      continue;
    }
    const link = links[0];
    const membership = link
      ? canonicalByPair.get(`${enrollment.classId}:${link.studentId}`)
      : undefined;
    if (!membership) {
      summary.legacy_only += 1;
      addDiscrepancy(discrepancies, {
        canonicalReference: link?.studentId ?? null,
        consumer: input.consumer,
        legacyReference: enrollment.enrollmentId,
        parityState: "LEGACY_ONLY",
        reasonCode: "canonical_enrollment_missing",
      });
      continue;
    }
    matchedCanonical.add(membership.membershipId);
    const compatibility = mapLegacyEnrollmentStatus(enrollment.status);
    if (!compatibility.compatible) {
      incrementState(summary, "UNSUPPORTED_LEGACY_STATE");
      addDiscrepancy(discrepancies, {
        canonicalReference: membership.membershipId,
        consumer: input.consumer,
        legacyReference: enrollment.enrollmentId,
        parityState: "UNSUPPORTED_LEGACY_STATE",
        reasonCode: compatibility.reason,
      });
      continue;
    }
    if (compatibility.canonicalStatus !== membership.status) {
      incrementState(summary, "STATUS_MISMATCH");
      addDiscrepancy(discrepancies, {
        canonicalReference: membership.membershipId,
        consumer: input.consumer,
        legacyReference: enrollment.enrollmentId,
        parityState: "STATUS_MISMATCH",
        reasonCode: "enrollment_status_not_equivalent",
      });
      continue;
    }
    summary.parity_match += 1;
  }

  for (const membership of canonical) {
    if (membership.organizationId !== input.snapshot.organizationId) {
      incrementState(summary, "TENANT_MISMATCH");
      addDiscrepancy(discrepancies, {
        canonicalReference: membership.membershipId,
        consumer: input.consumer,
        legacyReference: null,
        parityState: "TENANT_MISMATCH",
        reasonCode: "canonical_enrollment_tenant_mismatch",
      });
      continue;
    }
    if (matchedCanonical.has(membership.membershipId)) continue;
    summary.canonical_only += 1;
    if ((byStudent.get(membership.studentId)?.length ?? 0) === 0) {
      incrementState(summary, "IDENTITY_UNRESOLVED");
      addDiscrepancy(discrepancies, {
        canonicalReference: membership.membershipId,
        consumer: input.consumer,
        legacyReference: null,
        parityState: "IDENTITY_UNRESOLVED",
        reasonCode: "canonical_enrollment_account_link_missing",
      });
    } else {
      addDiscrepancy(discrepancies, {
        canonicalReference: membership.membershipId,
        consumer: input.consumer,
        legacyReference: null,
        parityState: "CANONICAL_ONLY",
        reasonCode: "legacy_enrollment_missing",
      });
    }
  }

  return finalize(
    input.consumer,
    input.snapshot.organizationId,
    summary,
    discrepancies,
  );
}

function filterIdentityReferences(
  input: LearnerShadowConsumerCheckInput,
  references: readonly {
    readonly accountId: string;
    readonly organizationId: string;
    readonly referenceId: string;
    readonly assignmentId?: string;
  }[],
) {
  const scope = normalizeScope(input.scope);
  const hasAssignmentScope = input.scope?.assignmentIds !== undefined;
  const hasAccountScope = input.scope?.legacyAccountIds !== undefined;
  return references.filter(
    (reference) =>
      (!hasAssignmentScope ||
        (reference.assignmentId !== undefined &&
          scope.assignmentIds.has(reference.assignmentId))) &&
      (!hasAccountScope || scope.legacyAccountIds.has(reference.accountId)),
  );
}

function mergeResults(
  consumer: LearnerShadowConsumer,
  organizationId: string,
  results: readonly LearnerShadowConsumerResult[],
): LearnerShadowConsumerResult {
  const summary = emptySummary();
  for (const result of results) {
    for (const key of Object.keys(summary) as (keyof MutableSummary)[]) {
      if (key !== "parity_rate") summary[key] += result.summary[key];
    }
  }
  return finalize(
    consumer,
    organizationId,
    summary,
    results.flatMap((result) => result.discrepancies),
  );
}

export function analyzeLearnerShadowConsumer(
  rawInput: LearnerShadowConsumerCheckInput,
): LearnerShadowConsumerResult {
  const snapshot = learnerParitySnapshotSchema.parse(rawInput.snapshot);
  const input = { ...rawInput, snapshot };
  switch (input.consumer) {
    case "class_read_detail":
    case "assignment_class_expansion":
      return compareEnrollments({
        consumer: input.consumer,
        scope: input.scope,
        snapshot,
      });
    case "teacher_dashboard":
      return mergeResults(input.consumer, snapshot.organizationId, [
        compareEnrollments({
          consumer: input.consumer,
          scope: input.scope,
          snapshot,
        }),
        compareIdentityReferences({
          consumer: input.consumer,
          legacyReferences: filterIdentityReferences(
            input,
            snapshot.assignmentRecipients.map((record) => ({
              accountId: record.accountId,
              assignmentId: record.assignmentId,
              organizationId: record.organizationId,
              referenceId: `${record.assignmentId}:${record.accountId}`,
            })),
          ),
          snapshot,
        }),
      ]);
    case "assignment_recipients":
      return compareIdentityReferences({
        consumer: input.consumer,
        legacyReferences: filterIdentityReferences(
          input,
          snapshot.assignmentRecipients.map((record) => ({
            accountId: record.accountId,
            assignmentId: record.assignmentId,
            organizationId: record.organizationId,
            referenceId: `${record.assignmentId}:${record.accountId}`,
          })),
        ),
        snapshot,
      });
    case "submission_self_resolution":
      return compareIdentityReferences({
        consumer: input.consumer,
        legacyReferences: filterIdentityReferences(
          input,
          snapshot.submissions.map((record) => ({
            accountId: record.accountId,
            assignmentId: record.assignmentId,
            organizationId: record.organizationId,
            referenceId: record.submissionId,
          })),
        ),
        snapshot,
      });
    case "learning_events":
      return compareIdentityReferences({
        consumer: input.consumer,
        legacyReferences: filterIdentityReferences(
          input,
          snapshot.learningEvents.map((record) => ({
            accountId: record.accountId,
            organizationId: record.organizationId,
            referenceId: record.eventId,
          })),
        ),
        snapshot,
      });
    case "mastery_subject_projections":
      return compareIdentityReferences({
        consumer: input.consumer,
        legacyReferences: filterIdentityReferences(
          input,
          snapshot.masteryRecords.map((record) => ({
            accountId: record.accountId,
            organizationId: record.organizationId,
            referenceId: record.recordId,
          })),
        ),
        snapshot,
      });
    case "adaptive_recommendations":
      return compareIdentityReferences({
        consumer: input.consumer,
        legacyReferences: [...normalizeScope(input.scope).legacyAccountIds].map(
          (accountId) => ({
            accountId,
            organizationId: snapshot.organizationId,
            referenceId: accountId,
          }),
        ),
        snapshot,
      });
    case "reporting":
      return mergeResults(input.consumer, snapshot.organizationId, [
        compareEnrollments({
          consumer: input.consumer,
          scope: input.scope,
          snapshot,
        }),
        compareIdentityReferences({
          consumer: input.consumer,
          legacyReferences: filterIdentityReferences(
            input,
            snapshot.masteryRecords.map((record) => ({
              accountId: record.accountId,
              organizationId: record.organizationId,
              referenceId: record.recordId,
            })),
          ),
          snapshot,
        }),
      ]);
    case "guardian_parent_portal":
      return compareIdentityReferences({
        consumer: input.consumer,
        legacyReferences: filterIdentityReferences(
          input,
          snapshot.guardianRelationships.map((record) => ({
            accountId: record.legacyStudentAccountId,
            organizationId: record.organizationId,
            referenceId: record.relationshipId,
          })),
        ),
        snapshot,
      });
  }
}

export function analyzeLearnerShadowSuite(
  input: LearnerShadowSuiteInput,
): readonly LearnerShadowConsumerResult[] {
  return Object.freeze(
    LEARNER_SHADOW_CONSUMERS.map((consumer) =>
      analyzeLearnerShadowConsumer({
        consumer,
        scope:
          consumer === "assignment_class_expansion"
            ? { classIds: input.assignmentClassIds ?? [] }
            : consumer === "adaptive_recommendations"
              ? { legacyAccountIds: input.adaptiveLegacyAccountIds }
              : undefined,
        snapshot: input.snapshot,
      }),
    ),
  );
}
