export const AI_GENERATION_CONTRACT_VERSION = 1 as const;

export type AiGenerationContractVersion = typeof AI_GENERATION_CONTRACT_VERSION;

export const AI_GENERATION_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

export type AiGenerationDifficulty =
  (typeof AI_GENERATION_DIFFICULTIES)[number];

export const AI_GENERATION_PROVIDER_STATUSES = [
  "AVAILABLE",
  "DEGRADED",
  "UNAVAILABLE",
] as const;

export type AiGenerationProviderStatus =
  (typeof AI_GENERATION_PROVIDER_STATUSES)[number];

export type GenerationId = string;
export type GenerationModelName = string;
export type GenerationProviderName = string;
export type GenerationKnowledgePointId = string;
export type GenerationCorrelationId = string;
