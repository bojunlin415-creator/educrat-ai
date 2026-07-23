import type { DependencyContractVersion } from "@/lib/dependency/domain/definition";
import type {
  DependencyResourceId,
  DependencyResourceType,
  DependencyType,
} from "@/lib/dependency/shared/references";

export const DEPENDENCY_DIRECTIONS = ["INBOUND", "OUTBOUND"] as const;
export type DependencyDirection = (typeof DEPENDENCY_DIRECTIONS)[number];

export interface DependencyReference {
  readonly dependencyType: DependencyType;
  readonly direction: DependencyDirection;
  readonly readonly: boolean;
  readonly relatedResourceId: DependencyResourceId;
  readonly relatedResourceType: DependencyResourceType;
  readonly resourceId: DependencyResourceId;
  readonly resourceType: DependencyResourceType;
  readonly version: DependencyContractVersion;
}
