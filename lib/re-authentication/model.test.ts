import { describe, expect, it } from "vitest";

import { ReAuthenticationRegistry } from "@/lib/re-authentication/application/re-authentication-registry";
import { REAUTHENTICATION_CONTRACT_VERSION } from "@/lib/re-authentication/domain/definition";
import type {
  ReAuthenticationActionType,
  ReAuthenticationChallengeType,
} from "@/lib/re-authentication/shared/references";

const actionType = "ORGANIZATION_DELETE_REQUEST" as ReAuthenticationActionType;
const challengeType = "OAUTH_REAUTH" as ReAuthenticationChallengeType;

function createDefinition() {
  return {
    actionTypes: [actionType],
    challengeTypes: [challengeType],
    requirements: [
      {
        actionType,
        challengeType,
        metadata: [{ key: "REAUTH_WINDOW" as const, value: 300 }],
        required: true,
        riskLevel: "LEVEL_3",
        version: REAUTHENTICATION_CONTRACT_VERSION,
      },
    ],
    version: REAUTHENTICATION_CONTRACT_VERSION,
  };
}

describe("re-authentication model", () => {
  it("freezes requirement snapshots at runtime", () => {
    const registry = new ReAuthenticationRegistry(createDefinition());
    const requirement = registry.definition.requirements[0];

    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.definition)).toBe(true);
    expect(Object.isFrozen(requirement)).toBe(true);
    expect(Object.isFrozen(requirement?.metadata)).toBe(true);
    expect(Object.isFrozen(requirement?.metadata[0])).toBe(true);
  });

  it("copies source definitions instead of keeping mutable references", () => {
    const definition = createDefinition();
    const registry = new ReAuthenticationRegistry(definition);

    const original = definition.requirements[0];
    if (original === undefined) throw new Error("Missing test requirement.");
    definition.requirements[0] = {
      ...original,
      riskLevel: "LEVEL_0",
    };

    expect(registry.definition.requirements[0]?.riskLevel).toBe("LEVEL_3");
  });
});
