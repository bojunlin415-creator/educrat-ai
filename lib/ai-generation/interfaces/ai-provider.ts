import type { AssembledPrompt } from "@/lib/ai-generation/domain/prompt";
import type {
  GenerationModelName,
  GenerationProviderName,
  AiGenerationProviderStatus,
} from "@/lib/ai-generation/shared/references";
import type { GenerationUsage } from "@/lib/ai-generation/domain/model";

export interface AIProviderHealth {
  readonly status: AiGenerationProviderStatus;
}

export interface AIProviderGenerateInput {
  readonly prompt: AssembledPrompt;
  readonly requestId: string;
}

export interface AIProviderGenerateOutput {
  readonly rawOutput: unknown;
  readonly usage: GenerationUsage;
}

export interface AIProvider {
  readonly generate: (
    input: AIProviderGenerateInput,
  ) => Promise<AIProviderGenerateOutput>;
  readonly health: () => Promise<AIProviderHealth>;
  readonly modelName: () => GenerationModelName;
  readonly providerName: () => GenerationProviderName;
}
