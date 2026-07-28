import type { RecycleBinContractVersion } from "@/lib/recycle-bin/domain/definition";
import type {
  RecycleBinActorId,
  RecycleBinResourceId,
  RecycleBinResourceType,
  RecycleBinTransition,
} from "@/lib/recycle-bin/shared/references";

export interface RestoreRequest {
  readonly requestedBy: RecycleBinActorId;
  readonly resourceId: RecycleBinResourceId;
  readonly resourceType: RecycleBinResourceType;
  readonly version: RecycleBinContractVersion;
}

export interface PermanentDeletionRequest {
  readonly requestedBy: RecycleBinActorId;
  readonly requestedTransition: RecycleBinTransition;
  readonly resourceId: RecycleBinResourceId;
  readonly resourceType: RecycleBinResourceType;
  readonly version: RecycleBinContractVersion;
}
