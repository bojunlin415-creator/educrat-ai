import { describe, expect, it } from "vitest";

import { ReAuthenticationRegistry } from "@/lib/re-authentication/application/re-authentication-registry";
import { REAUTHENTICATION_CONTRACT_VERSION } from "@/lib/re-authentication/domain/definition";
import { ReAuthenticationError } from "@/lib/re-authentication/domain/error";
import type {
  ReAuthenticationActionType,
  ReAuthenticationChallengeType,
} from "@/lib/re-authentication/shared/references";

const firstAction = "ROLE_ASSIGN" as ReAuthenticationActionType;
const secondAction = "EXPORT_AUDIT" as ReAuthenticationActionType;
const oauthChallenge = "OAUTH_REAUTH" as ReAuthenticationChallengeType;
const passwordChallenge = "PASSWORD_REAUTH" as ReAuthenticationChallengeType;

function createDefinition() {
  return {
    actionTypes: [secondAction, firstAction],
    challengeTypes: [passwordChallenge, oauthChallenge],
    requirements: [
      {
        actionType: secondAction,
        challengeType: passwordChallenge,
        metadata: [],
        required: true,
        riskLevel: "LEVEL_2",
        version: REAUTHENTICATION_CONTRACT_VERSION,
      },
      {
        actionType: firstAction,
        challengeType: oauthChallenge,
        metadata: [],
        required: true,
        riskLevel: "LEVEL_3",
        version: REAUTHENTICATION_CONTRACT_VERSION,
      },
    ],
    version: REAUTHENTICATION_CONTRACT_VERSION,
  };
}

describe("ReAuthenticationRegistry", () => {
  it("normalizes action, challenge, and requirement order", () => {
    const registry = new ReAuthenticationRegistry(createDefinition());

    expect(registry.definition.actionTypes).toEqual([
      "EXPORT_AUDIT",
      "ROLE_ASSIGN",
    ]);
    expect(registry.definition.challengeTypes).toEqual([
      "OAUTH_REAUTH",
      "PASSWORD_REAUTH",
    ]);
    expect(
      registry.definition.requirements.map((entry) => entry.actionType),
    ).toEqual(["EXPORT_AUDIT", "ROLE_ASSIGN"]);
  });

  it("rejects duplicate requirement action types", () => {
    const definition = createDefinition();

    expect(
      () =>
        new ReAuthenticationRegistry({
          ...definition,
          requirements: [
            definition.requirements[0],
            {
              ...definition.requirements[0],
              challengeType: oauthChallenge,
            },
          ],
        }),
    ).toThrow(
      new ReAuthenticationError("DUPLICATE_REAUTHENTICATION_REQUIREMENT"),
    );
  });

  it("does not expose mutation methods", () => {
    const registry = new ReAuthenticationRegistry(createDefinition());

    expect("register" in registry).toBe(false);
    expect("update" in registry).toBe(false);
    expect("delete" in registry).toBe(false);
  });
});
