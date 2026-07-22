import type { LifecycleState } from "@/lib/lifecycle/domain/state";
import type { LifecycleTransition } from "@/lib/lifecycle/domain/transition";
import type { LifecycleDefinitionId } from "@/lib/lifecycle/shared/references";

export const LIFECYCLE_DEFINITION_VERSION = 1 as const;
export type LifecycleDefinitionVersion = typeof LIFECYCLE_DEFINITION_VERSION;

export interface LifecycleDefinition {
  readonly definitionId: LifecycleDefinitionId;
  readonly states: readonly LifecycleState[];
  readonly transitions: readonly LifecycleTransition[];
  readonly version: LifecycleDefinitionVersion;
}
