import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAIResponsesProvider } from "@/lib/ai-generation/infrastructure/openai-responses-provider";
import { createAssembledPrompt } from "@/lib/ai-generation";

const prompt = createAssembledPrompt({
  messages: [
    { content: "system rules", role: "system" },
    { content: "user request", role: "user" },
  ],
  outputFormat: "json",
  templateVersion: 1,
});

const output = {
  challengeQuestions: [],
  examples: [
    {
      explanation: "說明",
      knowledgePointIds: ["kp-1"],
      prompt: "範例",
      solution: "解法",
    },
  ],
  knowledgePoints: [{ id: "kp-1", title: "知識點" }],
  learningObjectives: ["目標"],
  questions: [
    {
      answer: "答案",
      difficulty: "EASY",
      explanation: "解析",
      knowledgePointIds: ["kp-1"],
      prompt: "題目",
    },
  ],
  solutions: ["答案"],
  summary: ["整理"],
  teacherNotes: ["提醒"],
  title: "原創教材",
};

describe("OpenAI Responses provider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fails health closed when no API key is configured", async () => {
    const provider = new OpenAIResponsesProvider({});
    await expect(provider.health()).resolves.toEqual({ status: "UNAVAILABLE" });
  });

  it("calls the Responses API with strict JSON schema and translates usage", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({
        model: "gpt-test",
        output_text: JSON.stringify(output),
        usage: { input_tokens: 12, output_tokens: 34 },
      }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAIResponsesProvider({
      apiKey: "test-key",
      model: "gpt-test",
    });
    const result = await provider.generate({ prompt, requestId: "req-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const [, init] = fetchMock.mock.calls[0] as [
      string,
      { readonly body: string },
    ];
    expect(JSON.parse(init.body)).toMatchObject({
      input: "user request",
      instructions: "system rules",
      model: "gpt-test",
      text: {
        format: {
          name: "curriculum_generation",
          strict: true,
          type: "json_schema",
        },
      },
    });
    expect(result.rawOutput).toEqual(output);
    expect(result.usage).toMatchObject({
      inputTokens: 12,
      model: "gpt-test",
      outputTokens: 34,
      provider: "openai",
    });
  });
});
