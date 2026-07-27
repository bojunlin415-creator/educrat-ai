import type {
  RetentionCategory,
  RetentionMetadataCode,
  RetentionResourceType,
  RetentionTransition,
} from "@/lib/retention/shared/references";

export const RETENTION_CONTRACT_VERSION = 1 as const;
export type RetentionContractVersion = typeof RETENTION_CONTRACT_VERSION;

export const RETENTION_PERIOD_UNITS = ["DAYS", "MONTHS", "YEARS"] as const;
export type RetentionPeriodUnit = (typeof RETENTION_PERIOD_UNITS)[number];

export interface RetentionPeriod {
  readonly amount: number;
  readonly unit: RetentionPeriodUnit;
}

export type RetentionMetadataValue = boolean | number | RetentionMetadataCode;

export interface RetentionMetadataEntry {
  readonly key: RetentionMetadataCode;
  readonly value: RetentionMetadataValue;
}

export interface RetentionDefinition {
  readonly legalHoldSupported: boolean;
  readonly metadata: readonly RetentionMetadataEntry[];
  readonly minimumRetentionPeriod: RetentionPeriod;
  readonly resourceType: RetentionResourceType;
  readonly retentionCategory: RetentionCategory;
  readonly version: RetentionContractVersion;
}

export type RetentionRule = RetentionDefinition;

export interface RetentionRegistryDefinition {
  readonly definitions: readonly RetentionDefinition[];
  readonly retentionCategories: readonly RetentionCategory[];
  readonly transitions: readonly RetentionTransition[];
  readonly version: RetentionContractVersion;
}
