export interface PromptMessage {
  readonly content: string;
  readonly role: "system" | "user";
}

export interface PromptTemplate {
  readonly systemRules: readonly string[];
  readonly userFields: readonly string[];
  readonly version: number;
}

export interface AssembledPrompt {
  readonly messages: readonly PromptMessage[];
  readonly outputFormat: "json";
  readonly templateVersion: number;
}

export function createAssembledPrompt(input: AssembledPrompt): AssembledPrompt {
  return Object.freeze({
    ...input,
    messages: Object.freeze(
      input.messages.map((message) => Object.freeze({ ...message })),
    ),
  });
}
