import "server-only";

import type {
  AIProvider,
  AIProviderGenerateInput,
  AIProviderGenerateOutput,
  AIProviderHealth,
} from "@/lib/ai-generation/interfaces/ai-provider";
import type { GenerationUsage } from "@/lib/ai-generation/domain/model";
import type { AssembledPrompt } from "@/lib/ai-generation/domain/prompt";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const DEFAULT_MODEL = "gpt-5";

const curriculumGenerationJsonSchema = Object.freeze({
  additionalProperties: false,
  properties: {
    challengeQuestions: {
      items: { $ref: "#/$defs/question" },
      type: "array",
    },
    examples: {
      items: { $ref: "#/$defs/example" },
      minItems: 1,
      type: "array",
    },
    knowledgePoints: {
      items: {
        additionalProperties: false,
        properties: {
          id: { minLength: 1, type: "string" },
          title: { minLength: 1, type: "string" },
        },
        required: ["id", "title"],
        type: "object",
      },
      minItems: 1,
      type: "array",
    },
    learningObjectives: {
      items: { minLength: 1, type: "string" },
      minItems: 1,
      type: "array",
    },
    questions: {
      items: { $ref: "#/$defs/question" },
      type: "array",
    },
    solutions: {
      items: { minLength: 1, type: "string" },
      minItems: 1,
      type: "array",
    },
    summary: {
      items: { minLength: 1, type: "string" },
      minItems: 1,
      type: "array",
    },
    teacherNotes: {
      items: { minLength: 1, type: "string" },
      minItems: 1,
      type: "array",
    },
    title: { minLength: 1, type: "string" },
  },
  required: [
    "title",
    "learningObjectives",
    "summary",
    "examples",
    "questions",
    "challengeQuestions",
    "solutions",
    "teacherNotes",
    "knowledgePoints",
  ],
  type: "object",
  $defs: {
    example: {
      additionalProperties: false,
      properties: {
        explanation: { minLength: 1, type: "string" },
        knowledgePointIds: {
          items: { minLength: 1, type: "string" },
          minItems: 1,
          type: "array",
        },
        prompt: { minLength: 1, type: "string" },
        solution: { minLength: 1, type: "string" },
      },
      required: ["prompt", "solution", "explanation", "knowledgePointIds"],
      type: "object",
    },
    question: {
      additionalProperties: false,
      properties: {
        answer: { minLength: 1, type: "string" },
        difficulty: { enum: ["EASY", "MEDIUM", "HARD"], type: "string" },
        explanation: { minLength: 1, type: "string" },
        knowledgePointIds: {
          items: { minLength: 1, type: "string" },
          minItems: 1,
          type: "array",
        },
        prompt: { minLength: 1, type: "string" },
      },
      required: [
        "prompt",
        "answer",
        "difficulty",
        "explanation",
        "knowledgePointIds",
      ],
      type: "object",
    },
  },
});

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function promptPart(prompt: AssembledPrompt, role: "system" | "user"): string {
  return prompt.messages
    .filter((message) => message.role === role)
    .map((message) => message.content)
    .join("\n");
}

function extractOutputText(payload: unknown): string {
  if (!isRecord(payload)) throw new Error("OPENAI_RESPONSE_INVALID");
  if (typeof payload.output_text === "string") return payload.output_text;

  const output = payload.output;
  if (!Array.isArray(output)) throw new Error("OPENAI_RESPONSE_INVALID");

  const texts: string[] = [];
  for (const item of output) {
    if (!isRecord(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (!isRecord(content)) continue;
      if (typeof content.text === "string") texts.push(content.text);
    }
  }

  const text = texts.join("\n").trim();
  if (!text) throw new Error("OPENAI_RESPONSE_INVALID");
  return text;
}

function tokenUsage(payload: unknown) {
  if (!isRecord(payload) || !isRecord(payload.usage)) {
    return { inputTokens: 0, outputTokens: 0 };
  }
  return {
    inputTokens:
      typeof payload.usage.input_tokens === "number"
        ? payload.usage.input_tokens
        : 0,
    outputTokens:
      typeof payload.usage.output_tokens === "number"
        ? payload.usage.output_tokens
        : 0,
  };
}

export class OpenAIResponsesProvider implements AIProvider {
  readonly #apiKey: string | undefined;
  readonly #model: string;

  constructor(input: { readonly apiKey?: string; readonly model?: string }) {
    this.#apiKey = input.apiKey;
    this.#model = input.model ?? DEFAULT_MODEL;
  }

  async generate(
    input: AIProviderGenerateInput,
  ): Promise<AIProviderGenerateOutput> {
    if (!this.#apiKey) throw new Error("OPENAI_API_KEY_MISSING");
    const startedAt = Date.now();
    const response = await fetch(OPENAI_RESPONSES_URL, {
      body: JSON.stringify({
        input: promptPart(input.prompt, "user"),
        instructions: promptPart(input.prompt, "system"),
        metadata: { requestId: input.requestId },
        model: this.#model,
        text: {
          format: {
            name: "curriculum_generation",
            schema: curriculumGenerationJsonSchema,
            strict: true,
            type: "json_schema",
          },
        },
      }),
      headers: {
        authorization: `Bearer ${this.#apiKey}`,
        "content-type": "application/json",
      },
      method: "POST",
    });

    const payload: unknown = await response.json();
    if (!response.ok) throw new Error("OPENAI_RESPONSE_FAILED");

    const rawOutput: unknown = JSON.parse(extractOutputText(payload));
    const usage = tokenUsage(payload);
    const model =
      isRecord(payload) && typeof payload.model === "string"
        ? payload.model
        : this.#model;
    const generationUsage: GenerationUsage = Object.freeze({
      estimatedCost: 0,
      inputTokens: usage.inputTokens,
      latencyMs: Date.now() - startedAt,
      model,
      outputTokens: usage.outputTokens,
      provider: this.providerName(),
    });

    return Object.freeze({ rawOutput, usage: generationUsage });
  }

  async health(): Promise<AIProviderHealth> {
    return Object.freeze({
      status: this.#apiKey ? "AVAILABLE" : "UNAVAILABLE",
    });
  }

  modelName(): string {
    return this.#model;
  }

  providerName(): string {
    return "openai";
  }
}

export function createOpenAIResponsesProvider(): OpenAIResponsesProvider {
  return new OpenAIResponsesProvider({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL,
  });
}
