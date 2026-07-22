import type { LifecycleDefinition } from "@/lib/lifecycle/domain/definition";
import { validateLifecycleDefinition } from "@/lib/lifecycle/domain/validation";
import type { LifecycleDefinitionProvider } from "@/lib/lifecycle/interfaces/lifecycle-definition-provider";

export class StaticLifecycleDefinitionProvider implements LifecycleDefinitionProvider {
  readonly #definitions: readonly LifecycleDefinition[];

  constructor(definitions: readonly unknown[]) {
    this.#definitions = Object.freeze(
      definitions.map((definition) => validateLifecycleDefinition(definition)),
    );
  }

  getDefinitions(): readonly LifecycleDefinition[] {
    return this.#definitions;
  }
}
