import type { AssembledPrompt } from "@/lib/ai-generation/domain/prompt";

export interface OpenAIAdapterRequest {
  readonly messages: readonly {
    readonly content: string;
    readonly role: "system" | "user";
  }[];
  readonly responseFormat: "json_schema";
}

export interface OpenAIAdapterResponse {
  readonly content: unknown;
  readonly inputTokens: number;
  readonly latencyMs: number;
  readonly model: string;
  readonly outputTokens: number;
}

export interface OpenAIAdapterError {
  readonly code: string;
  readonly retryable: boolean;
}

export interface OpenAIAdapterBoundary {
  readonly mapPrompt: (prompt: AssembledPrompt) => OpenAIAdapterRequest;
  readonly translateError: (error: unknown) => OpenAIAdapterError;
  readonly translateResponse: (response: unknown) => OpenAIAdapterResponse;
}
