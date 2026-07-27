import { describe, expect, it } from "vitest";

import { evaluateReAuthentication } from "@/lib/re-authentication/application/re-authentication-evaluator";
import { ReAuthenticationRegistry } from "@/lib/re-authentication/application/re-authentication-registry";
import { REAUTHENTICATION_CONTRACT_VERSION } from "@/lib/re-authentication/domain/definition";
import type { ReAuthenticationPolicy } from "@/lib/re-authentication/interfaces/re-authentication-policy";
import type {
  ReAuthenticationActionType,
  ReAuthenticationChallengeType,
} from "@/lib/re-authentication/shared/references";

const actionType = "OWNERSHIP_TRANSFER" as ReAuthenticationActionType;
const challengeType = "OAUTH_REAUTH" as ReAuthenticationChallengeType;

const registry = new ReAuthenticationRegistry({
  actionTypes: [actionType],
  challengeTypes: [challengeType],
  requirements: [
    {
      actionType,
      challengeType,
      metadata: [],
      required: true,
      riskLevel: "LEVEL_3",
      version: REAUTHENTICATION_CONTRACT_VERSION,
    },
  ],
  version: REAUTHENTICATION_CONTRACT_VERSION,
});

const allowPolicy: ReAuthenticationPolicy = {
  evaluate: () => ({ decision: "ALLOW" }),
};

describe("evaluateReAuthentication", () => {
  it("returns challengeRequired when a required challenge is missing", () => {
    const decision = evaluateReAuthentication(
      {
        actionType,
        version: REAUTHENTICATION_CONTRACT_VERSION,
      },
      { policy: allowPolicy, registry },
    );

    expect(decision).toMatchObject({
      challengeRequired: true,
      decision: "ALLOWED",
      evaluation: { challengeStatus: "REQUIRED" },
    });
    expect(Object.isFrozen(decision)).toBe(true);
  });

  it("accepts a structurally valid matching challenge", () => {
    const decision = evaluateReAuthentication(
      {
        actionType,
        challenge: {
          challengeId: "challenge-001",
          challengeType,
          expiresAt: "2026-07-23T10:05:00Z",
          issuedAt: "2026-07-23T10:00:00Z",
          version: REAUTHENTICATION_CONTRACT_VERSION,
        },
        version: REAUTHENTICATION_CONTRACT_VERSION,
      },
      { policy: allowPolicy, registry },
    );

    expect(decision).toMatchObject({
      challengeRequired: false,
      decision: "ALLOWED",
      evaluation: { challengeStatus: "VALID" },
    });
  });

  it("fails closed for invalid challenge shape", () => {
    const decision = evaluateReAuthentication(
      {
        actionType,
        challenge: {
          challengeId: "challenge-001",
          challengeType,
          expiresAt: "2026-07-23T09:59:00Z",
          issuedAt: "2026-07-23T10:00:00Z",
          version: REAUTHENTICATION_CONTRACT_VERSION,
        },
        version: REAUTHENTICATION_CONTRACT_VERSION,
      },
      { policy: allowPolicy, registry },
    );

    expect(decision).toEqual({
      decision: "DENIED",
      denialCode: "INVALID_CHALLENGE",
      reason: "REAUTHENTICATION_CHALLENGE_INVALID",
    });
  });

  it("fails closed when policy denies", () => {
    const policy: ReAuthenticationPolicy = {
      evaluate: () => ({
        decision: "DENY",
        reason: "REAUTHENTICATION_POLICY_DENIED",
      }),
    };

    const decision = evaluateReAuthentication(
      {
        actionType,
        version: REAUTHENTICATION_CONTRACT_VERSION,
      },
      { policy, registry },
    );

    expect(decision).toEqual({
      decision: "DENIED",
      denialCode: "POLICY_DENIED",
      reason: "REAUTHENTICATION_POLICY_DENIED",
    });
  });

  it("fails closed when policy throws", () => {
    const policy: ReAuthenticationPolicy = {
      evaluate: () => {
        throw new Error("policy failure");
      },
    };

    const decision = evaluateReAuthentication(
      {
        actionType,
        version: REAUTHENTICATION_CONTRACT_VERSION,
      },
      { policy, registry },
    );

    expect(decision).toEqual({
      decision: "DENIED",
      denialCode: "POLICY_ERROR",
      reason: "REAUTHENTICATION_POLICY_EVALUATION_FAILED",
    });
  });
});
