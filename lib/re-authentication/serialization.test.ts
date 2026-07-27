import { describe, expect, it } from "vitest";

import { REAUTHENTICATION_CONTRACT_VERSION } from "@/lib/re-authentication/domain/definition";
import { serializeReAuthenticationCanonical } from "@/lib/re-authentication/domain/serialization";
import type {
  ReAuthenticationActionType,
  ReAuthenticationChallengeId,
  ReAuthenticationChallengeType,
} from "@/lib/re-authentication/shared/references";
import type { ReAuthenticationCheckRequest } from "@/lib/re-authentication/domain/request";

const actionType = "RETENTION_HOLD_RELEASE" as ReAuthenticationActionType;
const challengeType = "WEBAUTHN_REAUTH" as ReAuthenticationChallengeType;

describe("serializeReAuthenticationCanonical", () => {
  it("serializes equivalent values deterministically", () => {
    const left: ReAuthenticationCheckRequest = {
      actionType,
      challenge: {
        challengeId: "challenge-001" as ReAuthenticationChallengeId,
        challengeType,
        expiresAt: "2026-07-23T10:05:00Z",
        issuedAt: "2026-07-23T10:00:00Z",
        version: REAUTHENTICATION_CONTRACT_VERSION,
      },
      version: REAUTHENTICATION_CONTRACT_VERSION,
    };
    const right: ReAuthenticationCheckRequest = {
      version: REAUTHENTICATION_CONTRACT_VERSION,
      challenge: {
        version: REAUTHENTICATION_CONTRACT_VERSION,
        issuedAt: "2026-07-23T10:00:00Z",
        expiresAt: "2026-07-23T10:05:00Z",
        challengeType,
        challengeId: "challenge-001" as ReAuthenticationChallengeId,
      },
      actionType,
    };

    expect(serializeReAuthenticationCanonical(left)).toBe(
      serializeReAuthenticationCanonical(right),
    );
  });

  it("rejects circular values", () => {
    const value: Record<string, unknown> = { actionType };
    value.self = value;

    expect(() =>
      serializeReAuthenticationCanonical(
        value as unknown as Parameters<
          typeof serializeReAuthenticationCanonical
        >[0],
      ),
    ).toThrow("Cannot serialize circular re-authentication value.");
  });
});
