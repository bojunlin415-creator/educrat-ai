import type { DependencyContractVersion } from "@/lib/dependency/domain/definition";
import type {
  DependencyResourceId,
  DependencyResourceType,
  DependencyTransition,
} from "@/lib/dependency/shared/references";

export interface DependencyCheckRequest {
  readonly requestedTransition: DependencyTransition;
  readonly resourceId: DependencyResourceId;
  readonly resourceType: DependencyResourceType;
  readonly version: DependencyContractVersion;
}
