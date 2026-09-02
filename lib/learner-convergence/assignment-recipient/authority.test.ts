import {
  readAssignmentRecipientsByAuthority,
  resolveAssignmentRecipientAuthorityMode,
  resolveAssignmentRecipientWriteAuthority,
} from "@/lib/learner-convergence/assignment-recipient/authority";
import {
  AssignmentRecipientSourceError,
  type AssignmentRecipientProjection,
  type AssignmentRecipientSource,
} from "@/lib/learner-convergence/assignment-recipient/domain";

const canonicalStudentId = "10000000-0000-4000-8000-000000000001";
const assignmentId = "20000000-0000-4000-8000-000000000001";
const organizationId = "30000000-0000-4000-8000-000000000001";

function projection(
  identityAuthority: AssignmentRecipientProjection["identity_authority"],
): AssignmentRecipientProjection {
  return Object.freeze({
    assigned_at: "2026-09-02T00:00:00.000Z",
    assignment_id: assignmentId,
    canonical_student_id:
      identityAuthority === "LEGACY_ONLY_HISTORICAL"
        ? null
        : canonicalStudentId,
    identity_authority: identityAuthority,
    recipient_id:
      identityAuthority === "LEGACY_ONLY_HISTORICAL"
        ? null
        : "40000000-0000-4000-8000-000000000001",
    recipient_status: "not_started",
    source_class_ids: Object.freeze(["50000000-0000-4000-8000-000000000001"]),
  });
}

function source(input?: {
  readonly canonicalError?: AssignmentRecipientSourceError;
}): AssignmentRecipientSource {
  return {
    loadCanonical: vi.fn(async () => {
      if (input?.canonicalError) throw input.canonicalError;
      return Object.freeze([
        projection("CANONICAL"),
        projection("CANONICAL_WITH_LEGACY_COMPATIBILITY"),
      ]);
    }),
    loadLegacy: vi.fn(async () =>
      Object.freeze([projection("LEGACY_ONLY_HISTORICAL")]),
    ),
  };
}

function read(
  mode:
    | "CANONICAL_ONLY"
    | "CANONICAL_PRIMARY_LEGACY_FALLBACK"
    | "LEGACY_ONLY"
    | "LEGACY_PRIMARY_CANONICAL_SHADOW",
  recipientSource = source(),
) {
  const record = vi.fn();
  return {
    promise: readAssignmentRecipientsByAuthority({
      assignmentId,
      correlationId: "correlation-id",
      mode,
      observer: { record },
      organizationId,
      source: recipientSource,
    }),
    record,
    source: recipientSource,
  };
}

describe("LE-001 Phase 5E Assignment recipient authority", () => {
  it("uses canonical-primary read and verified compatibility write by default", async () => {
    expect(
      resolveAssignmentRecipientAuthorityMode({
        selectedMode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
      }),
    ).toBe("CANONICAL_PRIMARY_LEGACY_FALLBACK");
    expect(
      resolveAssignmentRecipientWriteAuthority(
        "CANONICAL_PRIMARY_LEGACY_FALLBACK",
      ),
    ).toBe("CANONICAL_WITH_VERIFIED_LEGACY_PROJECTION");

    const run = read("CANONICAL_PRIMARY_LEGACY_FALLBACK");
    await expect(run.promise).resolves.toMatchObject({
      fallbackUsed: false,
      returnedAuthority: "CANONICAL",
    });
    expect(run.source.loadLegacy).not.toHaveBeenCalled();
    expect(run.record).toHaveBeenCalledWith(
      expect.objectContaining({
        canonicalOnlyCount: 1,
        canonicalRecipientCount: 2,
        compatibilityMappedCount: 1,
        writeFallbackCount: 0,
      }),
    );
  });

  it("supports all read modes and a data-preserving LEGACY_ONLY rollback", async () => {
    await expect(read("LEGACY_ONLY").promise).resolves.toMatchObject({
      returnedAuthority: "LEGACY",
    });
    await expect(
      read("LEGACY_PRIMARY_CANONICAL_SHADOW").promise,
    ).resolves.toMatchObject({
      returnedAuthority: "LEGACY",
      shadowErrorCount: 0,
    });
    await expect(read("CANONICAL_ONLY").promise).resolves.toMatchObject({
      returnedAuthority: "CANONICAL",
    });
    expect(resolveAssignmentRecipientWriteAuthority("LEGACY_ONLY")).toBe(
      "LEGACY",
    );
  });

  it("falls back only for a typed canonical runtime failure", async () => {
    const runtime = read(
      "CANONICAL_PRIMARY_LEGACY_FALLBACK",
      source({
        canonicalError: new AssignmentRecipientSourceError("RUNTIME"),
      }),
    );
    await expect(runtime.promise).resolves.toMatchObject({
      fallbackUsed: true,
      returnedAuthority: "LEGACY",
    });

    for (const failure of ["SECURITY", "INTEGRITY"] as const) {
      const guarded = read(
        "CANONICAL_PRIMARY_LEGACY_FALLBACK",
        source({
          canonicalError: new AssignmentRecipientSourceError(failure),
        }),
      );
      await expect(guarded.promise).rejects.toMatchObject({ failure });
      expect(guarded.source.loadLegacy).not.toHaveBeenCalled();
    }
  });

  it("fails closed to LEGACY_ONLY when an operator supplies an unknown mode", () => {
    expect(
      resolveAssignmentRecipientAuthorityMode({
        configuredMode: "UNSAFE_MODE",
        selectedMode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
      }),
    ).toBe("LEGACY_ONLY");
  });

  it("returns immutable recipient projections", async () => {
    const result = await read("CANONICAL_ONLY").promise;
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.recipients)).toBe(true);
    expect(Object.isFrozen(result.recipients[0])).toBe(true);
    expect(Object.isFrozen(result.recipients[0]?.source_class_ids)).toBe(true);
  });
});
