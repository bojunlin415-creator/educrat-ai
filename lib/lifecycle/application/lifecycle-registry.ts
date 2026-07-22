import type {
  LifecycleDefinition,
  LifecycleDefinitionVersion,
} from "@/lib/lifecycle/domain/definition";
import { LifecycleError } from "@/lib/lifecycle/domain/error";
import type { LifecycleState } from "@/lib/lifecycle/domain/state";
import type { LifecycleTransition } from "@/lib/lifecycle/domain/transition";
import {
  parseLifecycleLookupCode,
  validateLifecycleDefinition,
  validateLifecycleLookupVersion,
} from "@/lib/lifecycle/domain/validation";
import type { LifecycleDefinitionProvider } from "@/lib/lifecycle/interfaces/lifecycle-definition-provider";

function definitionKey(definitionId: string, version: number): string {
  return `${definitionId}@${version}`;
}

export class LifecycleRegistry {
  readonly #definitions: ReadonlyMap<string, LifecycleDefinition>;

  constructor(provider: LifecycleDefinitionProvider) {
    const provided = provider.getDefinitions();
    if (!Array.isArray(provided) || provided.length === 0) {
      throw new LifecycleError("UNKNOWN_LIFECYCLE_DEFINITION");
    }

    const definitions = new Map<string, LifecycleDefinition>();
    for (const candidate of provided) {
      const definition = validateLifecycleDefinition(candidate);
      const key = definitionKey(definition.definitionId, definition.version);
      if (definitions.has(key)) {
        throw new LifecycleError("DUPLICATE_LIFECYCLE_DEFINITION");
      }
      definitions.set(key, definition);
    }
    this.#definitions = definitions;
  }

  getDefinition(
    definitionId: unknown,
    version: unknown,
  ): LifecycleDefinition | null {
    const normalizedId = parseLifecycleLookupCode(
      definitionId,
      "UNKNOWN_LIFECYCLE_DEFINITION",
    );
    const normalizedVersion = validateLifecycleLookupVersion(version);
    return (
      this.#definitions.get(definitionKey(normalizedId, normalizedVersion)) ??
      null
    );
  }

  getState(
    definition: LifecycleDefinition,
    stateId: unknown,
  ): LifecycleState | null {
    const normalizedId = parseLifecycleLookupCode(
      stateId,
      "UNKNOWN_LIFECYCLE_STATE",
    );
    return definition.states.find((state) => state.id === normalizedId) ?? null;
  }

  getTransition(
    definition: LifecycleDefinition,
    transitionId: unknown,
  ): LifecycleTransition | null {
    const normalizedId = parseLifecycleLookupCode(
      transitionId,
      "UNKNOWN_LIFECYCLE_TRANSITION",
    );
    return (
      definition.transitions.find(
        (transition) => transition.transitionId === normalizedId,
      ) ?? null
    );
  }

  hasDefinition(
    definitionId: unknown,
    version: LifecycleDefinitionVersion,
  ): boolean {
    return this.getDefinition(definitionId, version) !== null;
  }
}
