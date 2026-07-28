import type { RecycleBinRegistryDefinition } from "@/lib/recycle-bin/domain/definition";
import { validateRecycleBinRegistryDefinition } from "@/lib/recycle-bin/domain/validation";

function copyDefinition(
  definition: RecycleBinRegistryDefinition,
): RecycleBinRegistryDefinition {
  return Object.freeze({
    resourceTypes: Object.freeze([...definition.resourceTypes]),
    transitions: Object.freeze([...definition.transitions]),
    version: definition.version,
  });
}

export class RecycleBinRegistry {
  readonly definition: RecycleBinRegistryDefinition;

  constructor(input: unknown) {
    this.definition = copyDefinition(
      validateRecycleBinRegistryDefinition(input),
    );
    Object.freeze(this);
  }
}
