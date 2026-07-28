import type {
  RecycleBinResourceType,
  RecycleBinTransition,
} from "@/lib/recycle-bin/shared/references";

export const RECYCLE_BIN_CONTRACT_VERSION = 1 as const;

export type RecycleBinContractVersion = typeof RECYCLE_BIN_CONTRACT_VERSION;

export const RECYCLE_BIN_LIFECYCLE_STATES = [
  "TRASHED",
  "RESTORING",
  "PURGE_ELIGIBLE",
  "PURGED",
] as const;

export type RecycleBinLifecycleState =
  (typeof RECYCLE_BIN_LIFECYCLE_STATES)[number];

export interface RecycleBinRegistryDefinition {
  readonly resourceTypes: readonly RecycleBinResourceType[];
  readonly transitions: readonly RecycleBinTransition[];
  readonly version: RecycleBinContractVersion;
}
