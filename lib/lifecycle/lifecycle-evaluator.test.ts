import {
  CORE_LIFECYCLE_DEFINITION,
  LifecycleRegistry,
  StaticLifecycleDefinitionProvider,
  evaluateLifecycleTransition,
  type LifecyclePolicy,
} from "@/lib/lifecycle";

const allowPolicy: LifecyclePolicy = Object.freeze({
  evaluate: () => Object.freeze({ decision: "ALLOW" }),
});

const request = Object.freeze({
  currentStateId: "DRAFT",
  definitionId: "CORE_RESOURCE",
  intent: "PUBLISH",
  targetStateId: "PUBLISHED",
  transitionId: "DRAFT_TO_PUBLISHED",
  version: 1,
});

function registry(): LifecycleRegistry {
  return new LifecycleRegistry(
    new StaticLifecycleDefinitionProvider([CORE_LIFECYCLE_DEFINITION]),
  );
}

describe("lifecycle evaluator integration", () => {
  it("validates, resolves, applies policy, and returns an allowed decision", () => {
    const decision = evaluateLifecycleTransition(request, {
      policy: allowPolicy,
      registry: registry(),
    });

    expect(decision).toMatchObject({
      currentState: { id: "DRAFT" },
      decision: "ALLOWED",
      requirements: {
        auditRequired: true,
        authorizationRequired: true,
      },
      targetState: { id: "PUBLISHED" },
      transition: { transitionId: "DRAFT_TO_PUBLISHED" },
    });
  });

  it("denies unknown transitions and illegal jumps before policy evaluation", () => {
    const policy: LifecyclePolicy = { evaluate: vi.fn(allowPolicy.evaluate) };

    expect(
      evaluateLifecycleTransition(
        { ...request, transitionId: "UNKNOWN_TRANSITION" },
        { policy, registry: registry() },
      ),
    ).toEqual({
      decision: "DENIED",
      denialCode: "UNKNOWN_TRANSITION",
      reason: "LIFECYCLE_TRANSITION_NOT_FOUND",
    });
    expect(
      evaluateLifecycleTransition(
        { ...request, targetStateId: "DELETED" },
        { policy, registry: registry() },
      ),
    ).toEqual({
      decision: "DENIED",
      denialCode: "ILLEGAL_TRANSITION",
      reason: "LIFECYCLE_TRANSITION_MISMATCH",
    });
    expect(policy.evaluate).not.toHaveBeenCalled();
  });

  it("denies terminal outgoing requests", () => {
    expect(
      evaluateLifecycleTransition(
        {
          ...request,
          currentStateId: "DELETED",
          targetStateId: "PUBLISHED",
        },
        { policy: allowPolicy, registry: registry() },
      ),
    ).toEqual({
      decision: "DENIED",
      denialCode: "TERMINAL_STATE",
      reason: "TERMINAL_STATE_REJECTS_TRANSITION",
    });
  });

  it("returns the policy denial without executing requirements", () => {
    const policy: LifecyclePolicy = {
      evaluate: () => ({
        decision: "DENY",
        reason: "LIFECYCLE_POLICY_DENIED",
      }),
    };

    expect(
      evaluateLifecycleTransition(request, { policy, registry: registry() }),
    ).toEqual({
      decision: "DENIED",
      denialCode: "POLICY_DENIED",
      reason: "LIFECYCLE_POLICY_DENIED",
    });
  });

  it("fails closed for malformed requests and invalid policy output", () => {
    expect(
      evaluateLifecycleTransition(
        { ...request, credential: "forbidden" },
        { policy: allowPolicy, registry: registry() },
      ),
    ).toEqual({
      decision: "DENIED",
      denialCode: "INVALID_REQUEST",
      reason: "INVALID_LIFECYCLE_REQUEST",
    });

    const invalidPolicy = {
      evaluate: () => ({ decision: "ALLOW", unexpected: true }),
    };
    expect(
      evaluateLifecycleTransition(request, {
        policy: invalidPolicy as LifecyclePolicy,
        registry: registry(),
      }),
    ).toEqual({
      decision: "DENIED",
      denialCode: "POLICY_ERROR",
      reason: "LIFECYCLE_POLICY_EVALUATION_FAILED",
    });
  });

  it("fails closed when policy evaluation throws", () => {
    const policy: LifecyclePolicy = {
      evaluate: () => {
        throw new Error("internal policy failure");
      },
    };

    expect(
      evaluateLifecycleTransition(request, { policy, registry: registry() }),
    ).toEqual({
      decision: "DENIED",
      denialCode: "POLICY_ERROR",
      reason: "LIFECYCLE_POLICY_EVALUATION_FAILED",
    });
  });
});
