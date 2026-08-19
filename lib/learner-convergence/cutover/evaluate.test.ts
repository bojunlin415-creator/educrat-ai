import type { ConsumerCutoverReadinessInput } from "@/lib/learner-convergence/cutover/domain";
import { evaluateConsumerCutoverReadiness } from "@/lib/learner-convergence/cutover/evaluate";

function input(
  overrides: Partial<ConsumerCutoverReadinessInput> = {},
): ConsumerCutoverReadinessInput {
  return {
    canonicalPrimaryObserved: false,
    canonicalReadTested: true,
    consumer: "class_read_detail",
    cutoverRunbookApproved: false,
    dataStatus: "HAS_DATA",
    dependencies: [],
    dualReadVerified: false,
    dualWriteVerified: false,
    fallbackReady: true,
    identityAvailability: "NOT_APPLICABLE",
    identityRequirement: "NOT_REQUIRED",
    legacyFreezeApproved: false,
    legacyReadTested: true,
    parity: {
      ambiguous: 0,
      canonical_only: 0,
      identity_unresolved: 0,
      legacy_only: 0,
      orphan_reference: 0,
      parity_match: 2,
      parity_rate: 1,
      shadow_error_count: 0,
      status_mismatch: 0,
      tenant_mismatch: 0,
      total_canonical_references: 2,
      total_legacy_references: 2,
    },
    securityStatus: "READY",
    shadowStable: true,
    statusMapping: "DETERMINISTIC",
    unexplainedCanonicalOnlyCount: 0,
    unexplainedLegacyOnlyCount: 0,
    writeStrategy: "READ_ONLY",
    ...overrides,
  };
}

describe("LE-001 Phase 5 consumer readiness evaluator", () => {
  it("keeps empty evidence NOT_READY rather than treating zero rows as parity", () => {
    const result = evaluateConsumerCutoverReadiness(
      input({ dataStatus: "NO_DATA" }),
    );

    expect(result.readiness).toBe("NOT_READY");
    expect(result.blockingReasons).toContain("NO_EVIDENCE_DATA");
  });

  it("blocks required and conditionally consumed unresolved login identity", () => {
    const required = evaluateConsumerCutoverReadiness(
      input({
        consumer: "submission_self_resolution",
        identityAvailability: "MISSING",
        identityRequirement: "REQUIRED",
      }),
    );
    const conditional = evaluateConsumerCutoverReadiness(
      input({
        consumer: "reporting",
        identityAvailability: "MISSING",
        identityRequirement: "CONDITIONAL",
        parity: { ...input().parity, identity_unresolved: 1 },
      }),
    );

    expect(required.readiness).toBe("BLOCKED_IDENTITY");
    expect(conditional.readiness).toBe("BLOCKED_IDENTITY");
  });

  it("does not require an Account link for a managed class roster", () => {
    const result = evaluateConsumerCutoverReadiness(
      input({
        identityAvailability: "NOT_APPLICABLE",
        identityRequirement: "NOT_REQUIRED",
        parity: { ...input().parity, identity_unresolved: 2 },
      }),
    );

    expect(result.readiness).toBe("DUAL_READ_READY");
    expect(result.blockingReasons).not.toContain(
      "AUTHORITATIVE_IDENTITY_MISSING",
    );
  });

  it("classifies security, status, and unexplained data blockers explicitly", () => {
    expect(
      evaluateConsumerCutoverReadiness(input({ securityStatus: "BLOCKED" }))
        .readiness,
    ).toBe("BLOCKED_SECURITY");
    expect(
      evaluateConsumerCutoverReadiness(input({ statusMapping: "UNRESOLVED" }))
        .readiness,
    ).toBe("BLOCKED_STATUS_MAPPING");
    expect(
      evaluateConsumerCutoverReadiness(
        input({ unexplainedCanonicalOnlyCount: 1 }),
      ).readiness,
    ).toBe("BLOCKED_DATA");
  });

  it("requires fallback and both read paths before moving beyond SHADOW_STABLE", () => {
    const result = evaluateConsumerCutoverReadiness(
      input({ canonicalReadTested: false, fallbackReady: false }),
    );

    expect(result.readiness).toBe("SHADOW_STABLE");
    expect(result.blockingReasons).toEqual(
      expect.arrayContaining(["CANONICAL_READ_UNTESTED", "FALLBACK_NOT_READY"]),
    );
  });

  it("moves through dual-read, dual-write, cutover, canonical, and freeze gates", () => {
    const dualRead = evaluateConsumerCutoverReadiness(input());
    const dualWrite = evaluateConsumerCutoverReadiness(
      input({
        consumer: "assignment_recipients",
        dualReadVerified: true,
        writeStrategy: "DUAL_REFERENCE_WRITE",
      }),
    );
    const cutover = evaluateConsumerCutoverReadiness(
      input({ cutoverRunbookApproved: true, dualReadVerified: true }),
    );
    const canonical = evaluateConsumerCutoverReadiness(
      input({
        canonicalPrimaryObserved: true,
        cutoverRunbookApproved: true,
        dualReadVerified: true,
      }),
    );
    const frozen = evaluateConsumerCutoverReadiness(
      input({
        canonicalPrimaryObserved: true,
        cutoverRunbookApproved: true,
        dualReadVerified: true,
        legacyFreezeApproved: true,
      }),
    );

    expect(dualRead.readiness).toBe("DUAL_READ_READY");
    expect(dualWrite.readiness).toBe("DUAL_WRITE_READY");
    expect(cutover.readiness).toBe("CUTOVER_READY");
    expect(canonical.readiness).toBe("CANONICAL_PRIMARY");
    expect(frozen.readiness).toBe("LEGACY_FROZEN");
  });

  it("fails invalid evidence closed and returns immutable results", () => {
    const result = evaluateConsumerCutoverReadiness(
      input({ parity: { ...input().parity, tenant_mismatch: -1 } }),
    );

    expect(result.readiness).toBe("NOT_READY");
    expect(result.blockingReasons).toContain("INVALID_EVIDENCE");
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.blockingReasons)).toBe(true);
    expect(Object.isFrozen(result.prerequisites)).toBe(true);
  });
});
