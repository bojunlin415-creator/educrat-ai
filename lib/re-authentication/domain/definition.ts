import type {
  ReAuthenticationActionType,
  ReAuthenticationChallengeType,
  ReAuthenticationMetadataCode,
} from "@/lib/re-authentication/shared/references";

export const REAUTHENTICATION_CONTRACT_VERSION = 1 as const;

export type ReAuthenticationContractVersion =
  typeof REAUTHENTICATION_CONTRACT_VERSION;

export const REAUTHENTICATION_RISK_LEVELS = [
  "LEVEL_0",
  "LEVEL_1",
  "LEVEL_2",
  "LEVEL_3",
  "LEVEL_4",
] as const;

export type ReAuthenticationRiskLevel =
  (typeof REAUTHENTICATION_RISK_LEVELS)[number];

export type ReAuthenticationMetadataValue =
  boolean | number | ReAuthenticationMetadataCode;

export interface ReAuthenticationMetadataEntry {
  readonly key: ReAuthenticationMetadataCode;
  readonly value: ReAuthenticationMetadataValue;
}

export interface ReAuthenticationRequirement {
  readonly actionType: ReAuthenticationActionType;
  readonly challengeType: ReAuthenticationChallengeType;
  readonly metadata: readonly ReAuthenticationMetadataEntry[];
  readonly required: boolean;
  readonly riskLevel: ReAuthenticationRiskLevel;
  readonly version: ReAuthenticationContractVersion;
}

export interface ReAuthenticationRegistryDefinition {
  readonly actionTypes: readonly ReAuthenticationActionType[];
  readonly challengeTypes: readonly ReAuthenticationChallengeType[];
  readonly requirements: readonly ReAuthenticationRequirement[];
  readonly version: ReAuthenticationContractVersion;
}
