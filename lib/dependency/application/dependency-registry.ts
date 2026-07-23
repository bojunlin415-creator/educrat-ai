import type { DependencyDefinition } from "@/lib/dependency/domain/definition";
import { validateDependencyDefinition } from "@/lib/dependency/domain/validation";

export class DependencyRegistry {
  readonly #definition: DependencyDefinition;

  constructor(definition: unknown) {
    this.#definition = validateDependencyDefinition(definition);
  }

  get definition(): DependencyDefinition {
    return this.#definition;
  }

  hasDependencyType(dependencyType: string): boolean {
    return (this.#definition.dependencyTypes as readonly string[]).includes(
      dependencyType,
    );
  }

  hasResourceType(resourceType: string): boolean {
    return (this.#definition.resourceTypes as readonly string[]).includes(
      resourceType,
    );
  }

  hasTransition(transition: string): boolean {
    return (this.#definition.transitions as readonly string[]).includes(
      transition,
    );
  }
}
