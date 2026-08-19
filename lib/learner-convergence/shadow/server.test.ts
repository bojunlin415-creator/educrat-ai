import {
  ConsoleLearnerShadowDiagnosticSink,
  isLearnerShadowReadEnabled,
} from "@/lib/learner-convergence/shadow/server";

describe("LE-001 Phase 4 server control and privacy diagnostics", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(["1", "true", "enabled", " ENABLED "])(
    "enables only explicit value %s",
    (value) => expect(isLearnerShadowReadEnabled(value)).toBe(true),
  );

  it.each([undefined, "", "disabled", "yes", "unexpected"])(
    "fails disabled for %s",
    (value) => expect(isLearnerShadowReadEnabled(value)).toBe(false),
  );

  it("logs only the safe diagnostic contract", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    new ConsoleLearnerShadowDiagnosticSink().record({
      correlationId: "correlation-id",
      result: {
        consumer: "guardian_parent_portal",
        dataStatus: "HAS_DATA",
        discrepancies: [
          {
            canonicalReference: null,
            consumer: "guardian_parent_portal",
            legacyReference: "relationship-id",
            parityState: "IDENTITY_UNRESOLVED",
            reasonCode: "verified_account_link_missing",
          },
        ],
        organizationId: "organization-id",
        readiness: "BLOCKED_IDENTITY",
        summary: {
          ambiguous: 0,
          canonical_only: 0,
          identity_unresolved: 1,
          legacy_only: 1,
          orphan_reference: 0,
          parity_match: 0,
          parity_rate: 0,
          shadow_error_count: 0,
          status_mismatch: 0,
          tenant_mismatch: 0,
          total_canonical_references: 0,
          total_legacy_references: 1,
        },
        version: "le-001.shadow.v1",
      },
    });
    const serialized = JSON.stringify(info.mock.calls);
    expect(serialized).toContain("correlation-id");
    expect(serialized).not.toContain("email");
    expect(serialized).not.toContain("birthday");
    expect(serialized).not.toContain("token");
    expect(serialized).not.toContain("cookie");
    expect(serialized).not.toContain("password");
  });
});
