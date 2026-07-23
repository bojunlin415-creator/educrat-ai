import type {
  DependencyResourceType,
  DependencyTransition,
  DependencyType,
} from "@/lib/dependency/shared/references";

export const DEPENDENCY_CONTRACT_VERSION = 1 as const;
export type DependencyContractVersion = typeof DEPENDENCY_CONTRACT_VERSION;

export interface DependencyDefinition {
  readonly dependencyTypes: readonly DependencyType[];
  readonly resourceTypes: readonly DependencyResourceType[];
  readonly transitions: readonly DependencyTransition[];
  readonly version: DependencyContractVersion;
}
