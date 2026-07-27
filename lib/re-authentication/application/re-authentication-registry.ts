import type { ReAuthenticationRegistryDefinition } from "@/lib/re-authentication/domain/definition";
import { validateReAuthenticationRegistryDefinition } from "@/lib/re-authentication/domain/validation";

function copyDefinition(
  definition: ReAuthenticationRegistryDefinition,
): ReAuthenticationRegistryDefinition {
  return Object.freeze({
    actionTypes: Object.freeze([...definition.actionTypes]),
    challengeTypes: Object.freeze([...definition.challengeTypes]),
    requirements: Object.freeze(
      definition.requirements.map((requirement) =>
        Object.freeze({
          actionType: requirement.actionType,
          challengeType: requirement.challengeType,
          metadata: Object.freeze(
            requirement.metadata.map((entry) =>
              Object.freeze({ key: entry.key, value: entry.value }),
            ),
          ),
          required: requirement.required,
          riskLevel: requirement.riskLevel,
          version: requirement.version,
        }),
      ),
    ),
    version: definition.version,
  });
}

export class ReAuthenticationRegistry {
  readonly definition: ReAuthenticationRegistryDefinition;

  constructor(input: unknown) {
    this.definition = copyDefinition(
      validateReAuthenticationRegistryDefinition(input),
    );
    Object.freeze(this);
  }
}
