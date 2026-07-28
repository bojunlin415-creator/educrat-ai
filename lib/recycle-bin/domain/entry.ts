import type {
  RecycleBinContractVersion,
  RecycleBinLifecycleState,
} from "@/lib/recycle-bin/domain/definition";
import type {
  RecycleBinActorId,
  RecycleBinDependencyReference,
  RecycleBinLegalHoldReference,
  RecycleBinMetadataCode,
  RecycleBinOrganizationId,
  RecycleBinRecycleId,
  RecycleBinResourceId,
  RecycleBinResourceType,
  RecycleBinRetentionReference,
} from "@/lib/recycle-bin/shared/references";

export type RecycleBinMetadataValue = boolean | number | RecycleBinMetadataCode;

export interface RecycleBinMetadataEntry {
  readonly key: RecycleBinMetadataCode;
  readonly value: RecycleBinMetadataValue;
}

export interface RecycleEntry {
  readonly deletedAt: string;
  readonly deletedBy: RecycleBinActorId;
  readonly dependencyReference: RecycleBinDependencyReference;
  readonly legalHoldReference: RecycleBinLegalHoldReference;
  readonly lifecycleState: RecycleBinLifecycleState;
  readonly metadata: readonly RecycleBinMetadataEntry[];
  readonly organizationId: RecycleBinOrganizationId;
  readonly permanentDeleteEligible: boolean;
  readonly recycleId: RecycleBinRecycleId;
  readonly resourceId: RecycleBinResourceId;
  readonly resourceType: RecycleBinResourceType;
  readonly restoreEligible: boolean;
  readonly retentionReference: RecycleBinRetentionReference;
  readonly retentionUntil: string;
  readonly version: RecycleBinContractVersion;
}
