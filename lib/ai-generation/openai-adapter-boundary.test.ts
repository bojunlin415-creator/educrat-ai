import { describe, expect, it } from "vitest";

import {
  mapPromptToOpenAIAdapterRequest,
  translateOpenAIAdapterError,
  translateOpenAIAdapterResponse,
} from "@/lib/ai-generation";

describe("OpenAI adapter boundary", () => {
  it("maps prompts to adapter requests without SDK or HTTP behavior", () => {
    const request = mapPromptToOpenAIAdapterRequest({
      messages: [{ content: "請輸出 JSON", role: "system" }],
      outputFormat: "json",
      templateVersion: 1,
    });

    expect(request.responseFormat).toBe("json_schema");
    expect(request.messages[0]?.content).toBe("請輸出 JSON");
  });

  it("translates responses and errors through machine-readable boundary objects", () => {
    expect(
      translateOpenAIAdapterResponse({
        content: { title: "教材" },
        inputTokens: 10,
        latencyMs: 100,
        model: "model-a",
        outputTokens: 20,
      }),
    ).toEqual({
      content: { title: "教材" },
      inputTokens: 10,
      latencyMs: 100,
      model: "model-a",
      outputTokens: 20,
    });
    expect(
      translateOpenAIAdapterError({ code: "rate_limit", retryable: true }),
    ).toEqual({
      code: "rate_limit",
      retryable: true,
    });
  });
});
