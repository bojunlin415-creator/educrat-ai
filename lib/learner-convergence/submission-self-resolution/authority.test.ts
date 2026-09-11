import type { AssignmentRecipientProjection } from "@/lib/learner-convergence/assignment-recipient/domain";
import {
  readSubmissionSelfRecipients,
  requireCanonicalSubmissionIdentity,
  resolveSubmissionSelfAuthorityMode,
  resolveSubmissionSelfWriteAuthority,
} from "@/lib/learner-convergence/submission-self-resolution/authority";
import {
  SubmissionSelfResolutionError,
  SubmissionSelfSourceError,
  type SubmissionSelfRecipientSource,
} from "@/lib/learner-convergence/submission-self-resolution/domain";

const organizationId = "10000000-0000-4000-8000-000000000001";
const studentId = "20000000-0000-4000-8000-000000000001";

function recipient(
  authority: AssignmentRecipientProjection["identity_authority"],
): AssignmentRecipientProjection {
  return Object.freeze({
    assigned_at: "2026-09-07T00:00:00.000Z",
    assignment_id: "30000000-0000-4000-8000-000000000001",
    canonical_student_id:
      authority === "LEGACY_ONLY_HISTORICAL" ? null : studentId,
    identity_authority: authority,
    recipient_id:
      authority === "LEGACY_ONLY_HISTORICAL"
        ? null
        : "40000000-0000-4000-8000-000000000001",
    recipient_status: "not_started",
    source_class_ids: Object.freeze([]),
  });
}

function source(input?: {
  readonly canonicalError?: SubmissionSelfSourceError;
}): SubmissionSelfRecipientSource {
  return {
    loadCanonical: vi.fn(async () => {
      if (input?.canonicalError) throw input.canonicalError;
      return Object.freeze([recipient("CANONICAL")]);
    }),
    loadLegacy: vi.fn(async () =>
      Object.freeze([recipient("LEGACY_ONLY_HISTORICAL")]),
    ),
  };
}

describe("LE-001 Phase 5F submission self authority", () => {
  it("selects canonical-primary reads and canonical writes", () => {
    expect(
      resolveSubmissionSelfAuthorityMode({
        selectedMode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
      }),
    ).toBe("CANONICAL_PRIMARY_LEGACY_FALLBACK");
    expect(
      resolveSubmissionSelfWriteAuthority("CANONICAL_PRIMARY_LEGACY_FALLBACK"),
    ).toBe("CANONICAL");
    expect(resolveSubmissionSelfWriteAuthority("LEGACY_ONLY")).toBe("LEGACY");
  });

  it("fails closed to legacy-only for an unknown runtime mode", () => {
    expect(
      resolveSubmissionSelfAuthorityMode({
        configuredMode: "UNSAFE",
        selectedMode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
      }),
    ).toBe("LEGACY_ONLY");
  });

  it("maps only a same-organization linked identity", () => {
    expect(
      requireCanonicalSubmissionIdentity({
        activeOrganizationId: organizationId,
        resolution: {
          linkId: "50000000-0000-4000-8000-000000000001",
          organizationId,
          outcome: "linked",
          studentId,
        },
      }),
    ).toEqual(expect.objectContaining({ organizationId, studentId }));

    expect(() =>
      requireCanonicalSubmissionIdentity({
        activeOrganizationId: organizationId,
        resolution: {
          linkId: "50000000-0000-4000-8000-000000000001",
          organizationId: "60000000-0000-4000-8000-000000000001",
          outcome: "linked",
          studentId,
        },
      }),
    ).toThrow(
      expect.objectContaining<Partial<SubmissionSelfResolutionError>>({
        code: "cross_tenant_forbidden",
      }),
    );
  });

  it.each([
    ["no_link", "student_account_link_missing"],
    ["revoked_link", "student_account_link_inactive"],
    ["expired_link", "student_account_link_expired"],
    ["ambiguous_link", "student_identity_conflict"],
    ["wrong_organization", "cross_tenant_forbidden"],
    ["inactive_context", "submission_identity_unavailable"],
  ] as const)("maps %s to typed fail-closed error", (outcome, code) => {
    expect(() =>
      requireCanonicalSubmissionIdentity({
        activeOrganizationId: organizationId,
        resolution: { outcome },
      }),
    ).toThrow(expect.objectContaining({ code }));
  });

  it("falls back on canonical read runtime failure only", async () => {
    const runtimeSource = source({
      canonicalError: new SubmissionSelfSourceError("RUNTIME"),
    });
    const record = vi.fn();
    const result = await readSubmissionSelfRecipients({
      action: "READ",
      assignmentId: "30000000-0000-4000-8000-000000000001",
      correlationId: "correlation",
      mode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
      observer: { record },
      organizationId,
      source: runtimeSource,
    });
    expect(result).toMatchObject({
      fallbackUsed: true,
      returnedAuthority: "LEGACY",
    });
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ fallbackCount: 1, writeFallbackCount: 0 }),
    );

    for (const failure of ["IDENTITY", "INTEGRITY", "SECURITY"] as const) {
      const guardedSource = source({
        canonicalError: new SubmissionSelfSourceError(failure),
      });
      await expect(
        readSubmissionSelfRecipients({
          action: "READ",
          assignmentId: "30000000-0000-4000-8000-000000000001",
          correlationId: "correlation",
          mode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
          observer: { record: vi.fn() },
          organizationId,
          source: guardedSource,
        }),
      ).rejects.toMatchObject({ failure });
      expect(guardedSource.loadLegacy).not.toHaveBeenCalled();
    }
  });

  it("records comparison metrics only when shadow sources are both observed", async () => {
    const record = vi.fn();
    const canonical = recipient("CANONICAL");
    const legacyMatch = recipient("LEGACY_ONLY_HISTORICAL");
    const legacyOnly = Object.freeze({
      ...legacyMatch,
      assignment_id: "30000000-0000-4000-8000-000000000002",
    });
    await readSubmissionSelfRecipients({
      action: "READ",
      assignmentId: null,
      correlationId: "correlation",
      mode: "LEGACY_PRIMARY_CANONICAL_SHADOW",
      observer: { record },
      organizationId,
      source: {
        loadCanonical: vi.fn(async () => Object.freeze([canonical])),
        loadLegacy: vi.fn(async () => Object.freeze([legacyMatch, legacyOnly])),
      },
    });

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalOnlyCount: 0,
        legacyOnlyCount: 1,
        legacySelfResolutionSuccess: 1,
        matchedIdentityCount: 1,
        recipientMismatch: 1,
        tenantMismatch: 0,
      }),
    );
  });

  it("freezes read results and recipient projections", async () => {
    const result = await readSubmissionSelfRecipients({
      action: "READ",
      assignmentId: "30000000-0000-4000-8000-000000000001",
      correlationId: "correlation",
      mode: "CANONICAL_ONLY",
      observer: { record: vi.fn() },
      organizationId,
      source: source(),
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.recipients)).toBe(true);
    expect(Object.isFrozen(result.recipients[0])).toBe(true);
  });
});
