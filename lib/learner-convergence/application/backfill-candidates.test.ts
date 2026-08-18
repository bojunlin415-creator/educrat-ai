import {
  analyzeBackfillCandidates,
  classifyLearnerCandidate,
} from "@/lib/learner-convergence/application/backfill-candidates";

const organizationId = "10000000-0000-4000-8000-000000000001";
const otherOrganizationId = "10000000-0000-4000-8000-000000000002";
const studentId = "20000000-0000-4000-8000-000000000001";
const otherStudentId = "20000000-0000-4000-8000-000000000002";
const accountId = "30000000-0000-4000-8000-000000000001";
const correlationId = "40000000-0000-4000-8000-000000000001";
const referenceId = "50000000-0000-4000-8000-000000000001";

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    candidateAccountId: accountId,
    canonicalStudentId: studentId,
    correlationId,
    evidence: [
      {
        accountId,
        kind: "verified_operator_selection",
        organizationId,
        referenceId,
        studentId,
      },
    ],
    existingActiveLinks: [],
    organizationId,
    ...overrides,
  };
}

describe("LE-001 Phase 3 candidate classification", () => {
  it("accepts only a matching authoritative identity relationship", () => {
    expect(classifyLearnerCandidate(candidate())).toMatchObject({
      classification: "DETERMINISTIC_VERIFIED",
      proposedAction: "CREATE_ACTIVE_LINK",
      reasonCode: "authoritative_identity_verified",
    });
  });

  it("fails closed when competing identity authority exists", () => {
    expect(
      classifyLearnerCandidate(
        candidate({
          evidence: [
            candidate().evidence[0],
            {
              accountId,
              kind: "trusted_existing_mapping",
              organizationId,
              referenceId: "50000000-0000-4000-8000-000000000002",
              studentId: otherStudentId,
            },
          ],
        }),
      ),
    ).toMatchObject({ classification: "AMBIGUOUS" });
  });

  it("requires explicit repository evidence for managed Accountless Students", () => {
    expect(
      classifyLearnerCandidate(
        candidate({
          candidateAccountId: null,
          evidence: [
            {
              kind: "managed_accountless_marker",
              organizationId,
              referenceId,
              studentId,
            },
          ],
        }),
      ),
    ).toMatchObject({ classification: "MANAGED_ACCOUNTLESS" });
  });

  it("does not treat absence of an Account as managed evidence", () => {
    expect(
      classifyLearnerCandidate(
        candidate({ candidateAccountId: null, evidence: [] }),
      ),
    ).toMatchObject({ classification: "NO_VALID_CANDIDATE" });
  });

  it("rejects cross-tenant identity evidence", () => {
    expect(
      classifyLearnerCandidate(
        candidate({
          evidence: [
            {
              accountId,
              kind: "verified_account_claim",
              organizationId: otherOrganizationId,
              referenceId,
              studentId,
            },
          ],
        }),
      ),
    ).toMatchObject({ classification: "CROSS_TENANT_INVALID" });
  });

  it("rejects unknown fields instead of accepting heuristic evidence", () => {
    expect(() =>
      classifyLearnerCandidate(
        candidate({ email: "not-an-authority@example.invalid" }),
      ),
    ).toThrow();
  });

  it("blocks one Account from claiming multiple Students in one tenant", () => {
    const plan = analyzeBackfillCandidates([
      candidate(),
      candidate({
        canonicalStudentId: otherStudentId,
        correlationId: "40000000-0000-4000-8000-000000000002",
        evidence: [
          {
            accountId,
            kind: "repository_identity_reference",
            organizationId,
            referenceId: "50000000-0000-4000-8000-000000000002",
            studentId: otherStudentId,
          },
        ],
      }),
    ]);

    expect(plan.safeToExecute).toBe(false);
    expect(plan.summary.ambiguous).toBe(2);
    expect(plan.summary.deterministic_verified).toBe(0);
  });

  it("allows the same Account to have separate verified tenant contexts", () => {
    const plan = analyzeBackfillCandidates([
      candidate(),
      candidate({
        canonicalStudentId: otherStudentId,
        correlationId: "40000000-0000-4000-8000-000000000002",
        evidence: [
          {
            accountId,
            kind: "repository_identity_reference",
            organizationId: otherOrganizationId,
            referenceId: "50000000-0000-4000-8000-000000000002",
            studentId: otherStudentId,
          },
        ],
        organizationId: otherOrganizationId,
      }),
    ]);

    expect(plan.safeToExecute).toBe(true);
    expect(plan.summary.deterministic_verified).toBe(2);
  });
});
