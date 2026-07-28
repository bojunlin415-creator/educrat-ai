import type {
  AiGenerationContractVersion,
  AiGenerationDifficulty,
  GenerationCorrelationId,
  GenerationId,
  GenerationKnowledgePointId,
  GenerationModelName,
  GenerationProviderName,
} from "@/lib/ai-generation/shared/references";
import { AI_GENERATION_CONTRACT_VERSION } from "@/lib/ai-generation/shared/references";

export interface GenerationKnowledgePoint {
  readonly id: GenerationKnowledgePointId;
  readonly title: string;
  readonly competencyIndicator: string;
}

export interface GenerationContext {
  readonly curriculumReference: string;
  readonly difficulty: AiGenerationDifficulty;
  readonly grade: number;
  readonly includeExplanations: boolean;
  readonly knowledgePoints: readonly GenerationKnowledgePoint[];
  readonly questionCount: number;
  readonly subject: string;
  readonly unit: string;
}

export interface GenerationRequest {
  readonly context: GenerationContext;
  readonly correlationId: GenerationCorrelationId;
  readonly requestId: GenerationId;
  readonly version: AiGenerationContractVersion;
}

export interface GenerationUsage {
  readonly estimatedCost: number;
  readonly inputTokens: number;
  readonly latencyMs: number;
  readonly model: GenerationModelName;
  readonly outputTokens: number;
  readonly provider: GenerationProviderName;
}

export interface GenerationMetadata {
  readonly correlationId: GenerationCorrelationId;
  readonly model: GenerationModelName;
  readonly provider: GenerationProviderName;
  readonly requestId: GenerationId;
  readonly usage: GenerationUsage;
  readonly version: AiGenerationContractVersion;
}

export const GENERATION_ERROR_CODES = [
  "INVALID_REQUEST",
  "PROMPT_BUILD_FAILED",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_ERROR",
  "STRUCTURED_OUTPUT_INVALID",
  "KNOWLEDGE_MAPPING_INVALID",
  "GENERATION_FAILED",
] as const;

export type GenerationErrorCode = (typeof GENERATION_ERROR_CODES)[number];

export interface GenerationError {
  readonly code: GenerationErrorCode;
  readonly detail?: string;
}

export interface GenerationSuccess<TOutput> {
  readonly metadata: GenerationMetadata;
  readonly output: TOutput;
  readonly success: true;
}

export interface GenerationFailure {
  readonly error: GenerationError;
  readonly metadata?: GenerationMetadata;
  readonly success: false;
}

export type GenerationResult<TOutput> =
  GenerationFailure | GenerationSuccess<TOutput>;

export function createGenerationRequest(
  input: Omit<GenerationRequest, "version"> &
    Partial<Pick<GenerationRequest, "version">>,
): GenerationRequest {
  return Object.freeze({
    ...input,
    context: Object.freeze({
      ...input.context,
      knowledgePoints: Object.freeze(
        input.context.knowledgePoints.map((knowledgePoint) =>
          Object.freeze({ ...knowledgePoint }),
        ),
      ),
    }),
    version: input.version ?? AI_GENERATION_CONTRACT_VERSION,
  });
}

export function createGenerationUsage(input: GenerationUsage): GenerationUsage {
  return Object.freeze({ ...input });
}

export function createGenerationMetadata(
  input: GenerationMetadata,
): GenerationMetadata {
  return Object.freeze({
    ...input,
    usage: createGenerationUsage(input.usage),
  });
}

export function createGenerationFailure(
  error: GenerationError,
  metadata?: GenerationMetadata,
): GenerationFailure {
  return Object.freeze({
    error: Object.freeze({ ...error }),
    metadata: metadata ? createGenerationMetadata(metadata) : undefined,
    success: false,
  });
}

export function createGenerationSuccess<TOutput>(
  output: TOutput,
  metadata: GenerationMetadata,
): GenerationSuccess<TOutput> {
  return Object.freeze({
    metadata: createGenerationMetadata(metadata),
    output,
    success: true,
  });
}
