import type {
  RetentionDefinition,
  RetentionRegistryDefinition,
} from "@/lib/retention/domain/definition";
import { validateRetentionRegistryDefinition } from "@/lib/retention/domain/validation";

export class RetentionRegistry {
  readonly #definition: RetentionRegistryDefinition;

  constructor(definition: unknown) {
    this.#definition = validateRetentionRegistryDefinition(definition);
  }

  get definition(): RetentionRegistryDefinition {
    return this.#definition;
  }

  getDefinition(resourceType: string): RetentionDefinition | undefined {
    return this.#definition.definitions.find(
      (definition) => definition.resourceType === resourceType,
    );
  }

  hasRetentionCategory(category: string): boolean {
    return (this.#definition.retentionCategories as readonly string[]).includes(
      category,
    );
  }

  hasResourceType(resourceType: string): boolean {
    return this.getDefinition(resourceType) !== undefined;
  }

  hasTransition(transition: string): boolean {
    return (this.#definition.transitions as readonly string[]).includes(
      transition,
    );
  }
}
