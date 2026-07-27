import { describe, expect, it } from "vitest";

import { ReAuthenticationRegistry } from "@/lib/re-authentication/application/re-authentication-registry";
import { REAUTHENTICATION_CONTRACT_VERSION } from "@/lib/re-authentication/domain/definition";
import { ReAuthenticationError } from "@/lib/re-authentication/domain/error";
import {
  validateReAuthenticationCheckRequest,
  validateReAuthenticationPolicyResult,
} from "@/lib/re-authentication/domain/validation";
import type {
  ReAuthenticationActionType,
  ReAuthenticationChallengeType,
} from "@/lib/re-authentication/shared/references";

const actionType = "PERMANENT_DELETE" as ReAuthenticationActionType;
const challengeType = "PASSWORD_REAUTH" as ReAuthenticationChallengeType;

const registry = new ReAuthenticationRegistry({
  actionTypes: [actionType],
  challengeTypes: [challengeType],
  requirements: [
    {
      actionType,
      challengeType,
      metadata: [],
      required: true,
      riskLevel: "LEVEL_4",
      version: REAUTHENTICATION_CONTRACT_VERSION,
    },
  ],
  version: REAUTHENTICATION_CONTRACT_VERSION,
});

describe("re-authentication validation", () => {
  it("rejects unknown fields in requests", () => {
    expect(() =>
      validateReAuthenticationCheckRequest(
        {
          actionType,
          extra: "FIELD",
          version: REAUTHENTICATION_CONTRACT_VERSION,
        },
        registry.definition,
      ),
    ).toThrow(new ReAuthenticationError("INVALID_REAUTHENTICATION_INPUT"));
  });

  it("rejects unsupported contract versions", () => {
    expect(() =>
      validateReAuthenticationCheckRequest(
        {
          actionType,
          version: 999,
        },
        registry.definition,
      ),
    ).toThrow(
      new ReAuthenticationError("UNSUPPORTED_REAUTHENTICATION_VERSION"),
    );
  });

  it("rejects credential-like payloads by shape", () => {
    expect(() =>
      validateReAuthenticationCheckRequest(
        {
          actionType,
          challenge: {
            challengeId: "challenge-001",
            challengeType,
            expiresAt: "2026-07-23T10:05:00Z",
            issuedAt: "2026-07-23T10:00:00Z",
            otpCode: "123456",
            version: REAUTHENTICATION_CONTRACT_VERSION,
          },
          version: REAUTHENTICATION_CONTRACT_VERSION,
        },
        registry.definition,
      ),
    ).toThrow(new ReAuthenticationError("INVALID_REAUTHENTICATION_CHALLENGE"));
  });

  it("rejects malformed policy output", () => {
    expect(() =>
      validateReAuthenticationPolicyResult({
        decision: "ALLOW",
        reason: "EXTRA_REASON",
      }),
    ).toThrow(
      new ReAuthenticationError("INVALID_REAUTHENTICATION_POLICY_RESULT"),
    );
  });
});
