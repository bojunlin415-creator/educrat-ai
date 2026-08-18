import { z } from "zod";
import type {
  EnrollmentBackfillResult,
  EnrollmentParityInput,
  EnrollmentParityItem,
  EnrollmentParityPlan,
} from "@/lib/learner-convergence/domain/phase-3";
import { mapLegacyEnrollmentStatus } from "@/lib/learner-convergence/domain/status-compatibility";
import type { CanonicalEnrollmentBackfillGateway } from "@/lib/learner-convergence/interfaces/backfill-gateway";

const uuid = z.string().uuid();
const inputSchema = z
  .object({
    authoritativeLinks: z.array(
      z
        .object({
          accountId: uuid,
          linkId: uuid,
          organizationId: uuid,
          studentId: uuid,
        })
        .strict(),
    ),
    canonicalEnrollments: z.array(
      z
        .object({
          classId: uuid,
          membershipId: uuid,
          organizationId: uuid,
          status: z.enum(["active", "left"]),
          studentId: uuid,
        })
        .strict(),
    ),
    legacyEnrollments: z.array(
      z
        .object({
          accountId: uuid,
          classId: uuid,
          enrollmentId: uuid,
          organizationId: uuid,
          status: z.enum(["active", "inactive", "left"]),
        })
        .strict(),
    ),
    managedAccountlessStudentIds: z.array(uuid),
    organizationId: uuid,
  })
  .strict();

function freezeItem(item: EnrollmentParityItem): EnrollmentParityItem {
  return Object.freeze({ ...item });
}

export function analyzeEnrollmentParity(input: unknown): EnrollmentParityPlan {
  const parsed = inputSchema.parse(input) as EnrollmentParityInput;
  const items: EnrollmentParityItem[] = [];
  const matchedCanonical = new Set<string>();
  const scopedLinks = parsed.authoritativeLinks.filter(
    (link) => link.organizationId === parsed.organizationId,
  );
  const linksByAccount = new Map<string, typeof scopedLinks>();
  const linksByStudent = new Map<string, typeof scopedLinks>();
  for (const link of scopedLinks) {
    linksByAccount.set(link.accountId, [
      ...(linksByAccount.get(link.accountId) ?? []),
      link,
    ]);
    linksByStudent.set(link.studentId, [
      ...(linksByStudent.get(link.studentId) ?? []),
      link,
    ]);
  }

  for (const legacy of parsed.legacyEnrollments) {
    const base = {
      accountId: legacy.accountId,
      canonicalMembershipId: null,
      canonicalOnlyReview: null,
      canonicalStatus: null,
      classId: legacy.classId,
      legacyEnrollmentId: legacy.enrollmentId,
      legacyStatus: legacy.status,
      organizationId: legacy.organizationId,
      studentId: null,
    } as const;
    if (legacy.organizationId !== parsed.organizationId) {
      items.push(freezeItem({ ...base, classification: "TENANT_MISMATCH" }));
      continue;
    }
    const identities = linksByAccount.get(legacy.accountId) ?? [];
    if (identities.length !== 1) {
      const hasCrossTenantIdentity = parsed.authoritativeLinks.some(
        (link) =>
          link.accountId === legacy.accountId &&
          link.organizationId !== parsed.organizationId,
      );
      items.push(
        freezeItem({
          ...base,
          classification: hasCrossTenantIdentity
            ? "TENANT_MISMATCH"
            : "IDENTITY_UNRESOLVED",
        }),
      );
      continue;
    }
    const identity = identities[0];
    if (!identity) throw new Error("identity_resolution_invariant_failed");
    const canonical = parsed.canonicalEnrollments.find(
      (record) =>
        record.organizationId === parsed.organizationId &&
        record.classId === legacy.classId &&
        record.studentId === identity.studentId,
    );
    if (canonical) matchedCanonical.add(canonical.membershipId);
    const status = mapLegacyEnrollmentStatus(legacy.status);
    if (!status.compatible) {
      items.push(
        freezeItem({
          ...base,
          canonicalMembershipId: canonical?.membershipId ?? null,
          canonicalStatus: canonical?.status ?? null,
          classification: "STATUS_MISMATCH",
          studentId: identity.studentId,
        }),
      );
      continue;
    }
    if (!canonical) {
      items.push(
        freezeItem({
          ...base,
          canonicalStatus: status.canonicalStatus,
          classification: "LEGACY_ONLY",
          studentId: identity.studentId,
        }),
      );
      continue;
    }
    items.push(
      freezeItem({
        ...base,
        canonicalMembershipId: canonical.membershipId,
        canonicalStatus: canonical.status,
        classification:
          canonical.status === status.canonicalStatus
            ? "PARITY_MATCH"
            : "STATUS_MISMATCH",
        studentId: identity.studentId,
      }),
    );
  }

  for (const canonical of parsed.canonicalEnrollments) {
    if (matchedCanonical.has(canonical.membershipId)) continue;
    const base = {
      accountId: null,
      canonicalMembershipId: canonical.membershipId,
      canonicalStatus: canonical.status,
      classId: canonical.classId,
      legacyEnrollmentId: null,
      legacyStatus: null,
      organizationId: canonical.organizationId,
      studentId: canonical.studentId,
    } as const;
    if (canonical.organizationId !== parsed.organizationId) {
      items.push(
        freezeItem({
          ...base,
          canonicalOnlyReview: "tenant_mismatch",
          classification: "TENANT_MISMATCH",
        }),
      );
      continue;
    }
    const identities = linksByStudent.get(canonical.studentId) ?? [];
    if (identities.length !== 1) {
      const hasCrossTenantIdentity = parsed.authoritativeLinks.some(
        (link) =>
          link.studentId === canonical.studentId &&
          link.organizationId !== parsed.organizationId,
      );
      items.push(
        freezeItem({
          ...base,
          canonicalOnlyReview: hasCrossTenantIdentity
            ? "tenant_mismatch"
            : parsed.managedAccountlessStudentIds.includes(canonical.studentId)
              ? "expected_managed_accountless"
              : "identity_unresolved",
          classification: hasCrossTenantIdentity
            ? "TENANT_MISMATCH"
            : "IDENTITY_UNRESOLVED",
        }),
      );
      continue;
    }
    items.push(
      freezeItem({
        ...base,
        accountId: identities[0]?.accountId ?? null,
        canonicalOnlyReview: "deterministic_legacy_equivalent",
        classification: "CANONICAL_ONLY",
      }),
    );
  }

  items.sort((left, right) =>
    `${left.classification}:${left.legacyEnrollmentId ?? left.canonicalMembershipId}`.localeCompare(
      `${right.classification}:${right.legacyEnrollmentId ?? right.canonicalMembershipId}`,
    ),
  );
  const count = (classification: EnrollmentParityItem["classification"]) =>
    items.filter((item) => item.classification === classification).length;
  const rawCanonicalOnly = parsed.canonicalEnrollments.filter(
    (canonical) =>
      !parsed.legacyEnrollments.some((legacy) => {
        const identity = (linksByAccount.get(legacy.accountId) ?? [])[0];
        return (
          legacy.organizationId === canonical.organizationId &&
          legacy.classId === canonical.classId &&
          identity?.studentId === canonical.studentId
        );
      }),
  ).length;
  return Object.freeze({
    items: Object.freeze(items),
    summary: Object.freeze({
      canonical_only: rawCanonicalOnly,
      identity_unresolved: count("IDENTITY_UNRESOLVED"),
      legacy_only: count("LEGACY_ONLY"),
      parity_match: count("PARITY_MATCH"),
      status_mismatch: count("STATUS_MISMATCH"),
      tenant_mismatch: count("TENANT_MISMATCH"),
    }),
  });
}

export async function executeDeterministicEnrollmentBackfill(input: {
  readonly correlationIds: Readonly<Record<string, string>>;
  readonly dryRun: boolean;
  readonly gateway: CanonicalEnrollmentBackfillGateway;
  readonly joinedAtByLegacyEnrollment: Readonly<Record<string, string>>;
  readonly plan: EnrollmentParityPlan;
}): Promise<readonly EnrollmentBackfillResult[]> {
  if (input.dryRun) return Object.freeze([]);
  const results: EnrollmentBackfillResult[] = [];
  for (const item of input.plan.items) {
    if (
      item.classification !== "LEGACY_ONLY" ||
      item.accountId === null ||
      item.studentId === null ||
      item.legacyEnrollmentId === null ||
      item.canonicalStatus === null
    ) {
      continue;
    }
    const correlationId = uuid.parse(
      input.correlationIds[item.legacyEnrollmentId],
    );
    const joinedAt = z
      .string()
      .datetime({ offset: true })
      .parse(input.joinedAtByLegacyEnrollment[item.legacyEnrollmentId]);
    const existing = await input.gateway.loadCanonicalEnrollments({
      classId: item.classId,
      organizationId: item.organizationId,
      studentId: item.studentId,
    });
    const exact = existing.filter(
      (record) =>
        record.organizationId === item.organizationId &&
        record.studentId === item.studentId,
    );
    if (exact.length > 1) {
      results.push(
        Object.freeze({
          canonicalMembershipId: null,
          correlationId,
          legacyEnrollmentId: item.legacyEnrollmentId,
          outcome: "blocked",
          reasonCode: "enrollment_conflict",
        }),
      );
      continue;
    }
    if (exact.length === 1) {
      if (exact[0]?.status !== item.canonicalStatus) {
        results.push(
          Object.freeze({
            canonicalMembershipId: exact[0]?.membershipId ?? null,
            correlationId,
            legacyEnrollmentId: item.legacyEnrollmentId,
            outcome: "blocked",
            reasonCode: "enrollment_conflict",
          }),
        );
        continue;
      }
      results.push(
        Object.freeze({
          canonicalMembershipId: exact[0]?.membershipId ?? null,
          correlationId,
          legacyEnrollmentId: item.legacyEnrollmentId,
          outcome: "idempotent",
          reasonCode: "already_exists",
        }),
      );
      continue;
    }
    const created = await input.gateway.createCanonicalEnrollment({
      accountId: item.accountId,
      classId: item.classId,
      correlationId,
      joinedAt,
      legacyEnrollmentId: item.legacyEnrollmentId,
      organizationId: item.organizationId,
      status: item.canonicalStatus,
      studentId: item.studentId,
    });
    if (created.correlationId !== correlationId) {
      throw new Error("invalid_enrollment_backfill_receipt");
    }
    results.push(
      Object.freeze({
        canonicalMembershipId: uuid.parse(created.canonicalMembershipId),
        correlationId,
        legacyEnrollmentId: item.legacyEnrollmentId,
        outcome: "created",
        reasonCode: "created",
      }),
    );
  }
  return Object.freeze(results);
}
