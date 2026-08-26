import { readAssignmentClassExpansionByAuthority } from "@/lib/learner-convergence/assignment-class-expansion/authority";
import type {
  AssignmentClassExpansionCandidate,
  AssignmentClassExpansionSource,
} from "@/lib/learner-convergence/assignment-class-expansion/domain";
import { ClassRosterSourceError } from "@/lib/learner-convergence/class-roster/errors";

const organizationId = "10000000-0000-4000-8000-000000000001";
const classId = "20000000-0000-4000-8000-000000000001";
const secondClassId = "20000000-0000-4000-8000-000000000002";
const canonicalStudentId = "30000000-0000-4000-8000-000000000001";
const legacyRecipientId = "40000000-0000-4000-8000-000000000001";

function canonical(
  classReference = classId,
  membershipId = "50000000-0000-4000-8000-000000000001",
): AssignmentClassExpansionCandidate {
  return Object.freeze({
    canonicalStudentId,
    classId: classReference,
    legacyRecipientId: null,
    membershipId,
    organizationId,
    source: "CANONICAL",
  });
}

function legacy(): AssignmentClassExpansionCandidate {
  return Object.freeze({
    canonicalStudentId: null,
    classId,
    legacyRecipientId,
    membershipId: "60000000-0000-4000-8000-000000000001",
    organizationId,
    source: "LEGACY",
  });
}

function source(input?: {
  readonly canonical?: readonly AssignmentClassExpansionCandidate[];
  readonly canonicalError?: Error;
  readonly legacy?: readonly AssignmentClassExpansionCandidate[];
}): AssignmentClassExpansionSource {
  return {
    loadCanonical: vi.fn(async () => {
      if (input?.canonicalError) throw input.canonicalError;
      return input?.canonical ?? [canonical()];
    }),
    loadLegacy: vi.fn(async () => input?.legacy ?? [legacy()]),
  };
}

function read(input: {
  readonly mode:
    | "CANONICAL_ONLY"
    | "CANONICAL_PRIMARY_LEGACY_FALLBACK"
    | "LEGACY_ONLY"
    | "LEGACY_PRIMARY_CANONICAL_SHADOW";
  readonly source: AssignmentClassExpansionSource;
  readonly mapped?: boolean;
}) {
  return readAssignmentClassExpansionByAuthority({
    actorRole: "organization_owner",
    assignmentId: null,
    classCount: 2,
    compatibilityResolver: {
      resolve: async () =>
        Object.freeze({
          expectedAccountlessStudentIds: Object.freeze(
            input.mapped ? [] : [canonicalStudentId],
          ),
          references: Object.freeze(
            input.mapped ? [{ canonicalStudentId, legacyRecipientId }] : [],
          ),
        }),
    },
    correlationId: "correlation-id",
    mode: input.mode,
    observer: { record: vi.fn() },
    organizationId,
    source: input.source,
  });
}

describe("LE-001 Phase 5D Assignment class expansion authority", () => {
  it("deduplicates one canonical Student across multiple Classes and preserves origins", async () => {
    const result = await read({
      mapped: true,
      mode: "CANONICAL_ONLY",
      source: source({
        canonical: [
          canonical(),
          canonical(secondClassId, "50000000-0000-4000-8000-000000000002"),
        ],
      }),
    });

    expect(result).toMatchObject({
      authority: "CANONICAL",
      canonicalCandidateCount: 1,
      compatibilityMappedCount: 1,
      identityUnresolvedCount: 0,
      legacyRecipientIds: [legacyRecipientId],
    });
    expect(result.candidates[0]).toMatchObject({
      canonicalStudentId,
      classIds: [classId, secondClassId],
    });
  });

  it("keeps an accountless canonical candidate visible but unavailable for legacy materialization", async () => {
    const result = await read({
      mode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
      source: source(),
    });

    expect(result).toMatchObject({
      authority: "CANONICAL",
      expectedAccountlessCandidateCount: 1,
      fallbackUsed: false,
      identityUnresolvedCount: 1,
      legacyRecipientIds: [],
    });
    expect(result.candidates[0]?.canonicalStudentId).toBe(canonicalStudentId);
  });

  it("supports legacy, shadow, canonical-primary, canonical-only, and rollback without writes", async () => {
    const legacySource = source();
    await expect(
      read({ mode: "LEGACY_ONLY", source: legacySource }),
    ).resolves.toMatchObject({ authority: "LEGACY", fallbackUsed: false });
    await expect(
      read({
        mode: "LEGACY_PRIMARY_CANONICAL_SHADOW",
        source: legacySource,
      }),
    ).resolves.toMatchObject({
      authority: "LEGACY",
      canonicalCandidateCount: 1,
      shadowErrorCount: 0,
    });
    await expect(
      read({
        mapped: true,
        mode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
        source: legacySource,
      }),
    ).resolves.toMatchObject({ authority: "CANONICAL" });
    await expect(
      read({ mapped: true, mode: "CANONICAL_ONLY", source: legacySource }),
    ).resolves.toMatchObject({ authority: "CANONICAL" });
    await expect(
      read({ mode: "LEGACY_ONLY", source: legacySource }),
    ).resolves.toMatchObject({
      authority: "LEGACY",
      legacyRecipientIds: [legacyRecipientId],
    });
  });

  it("falls back only for a canonical runtime failure", async () => {
    const runtimeSource = source({
      canonicalError: new ClassRosterSourceError("CANONICAL_RUNTIME_FAILURE"),
    });
    await expect(
      read({
        mode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
        source: runtimeSource,
      }),
    ).resolves.toMatchObject({
      authority: "LEGACY",
      fallbackUsed: true,
      legacyRecipientIds: [legacyRecipientId],
    });

    const integritySource = source({
      canonicalError: new ClassRosterSourceError("CANONICAL_INTEGRITY_FAILURE"),
    });
    await expect(
      read({
        mode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
        source: integritySource,
      }),
    ).rejects.toMatchObject({ code: "CANONICAL_INTEGRITY_FAILURE" });
    expect(integritySource.loadLegacy).not.toHaveBeenCalled();
  });
});
