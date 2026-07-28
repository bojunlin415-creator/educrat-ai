import type {
  OpenAIAdapterBoundary,
  OpenAIAdapterError,
  OpenAIAdapterRequest,
  OpenAIAdapterResponse,
} from "@/lib/ai-generation/interfaces/openai-adapter";
import type { AssembledPrompt } from "@/lib/ai-generation/domain/prompt";

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mapPromptToOpenAIAdapterRequest(
  prompt: AssembledPrompt,
): OpenAIAdapterRequest {
  return Object.freeze({
    messages: Object.freeze(
      prompt.messages.map((message) => Object.freeze({ ...message })),
    ),
    responseFormat: "json_schema",
  });
}

export function translateOpenAIAdapterResponse(
  response: unknown,
): OpenAIAdapterResponse {
  if (!isRecord(response)) {
    throw new Error("INVALID_OPENAI_ADAPTER_RESPONSE");
  }
  const content = response.content;
  const inputTokens = response.inputTokens;
  const outputTokens = response.outputTokens;
  const latencyMs = response.latencyMs;
  const model = response.model;
  if (
    typeof inputTokens !== "number" ||
    typeof outputTokens !== "number" ||
    typeof latencyMs !== "number" ||
    typeof model !== "string"
  ) {
    throw new Error("INVALID_OPENAI_ADAPTER_RESPONSE");
  }
  return Object.freeze({
    content,
    inputTokens,
    latencyMs,
    model,
    outputTokens,
  });
}

export function translateOpenAIAdapterError(
  error: unknown,
): OpenAIAdapterError {
  if (!isRecord(error)) {
    return Object.freeze({ code: "UNKNOWN_OPENAI_ERROR", retryable: false });
  }
  return Object.freeze({
    code: typeof error.code === "string" ? error.code : "UNKNOWN_OPENAI_ERROR",
    retryable: error.retryable === true,
  });
}

export const openAIAdapterBoundary: OpenAIAdapterBoundary = Object.freeze({
  mapPrompt: mapPromptToOpenAIAdapterRequest,
  translateError: translateOpenAIAdapterError,
  translateResponse: translateOpenAIAdapterResponse,
});
