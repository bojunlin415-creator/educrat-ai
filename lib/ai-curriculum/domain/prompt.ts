import type { CurriculumGenerationInput } from "@/lib/ai-curriculum/domain/input";

export interface CurriculumPrompt {
  readonly messages: readonly CurriculumPromptMessage[];
  readonly safetyRules: readonly string[];
  readonly version: number;
}

export interface CurriculumPromptMessage {
  readonly content: string;
  readonly role: "system" | "user";
}

export interface PromptBuildContext {
  readonly input: CurriculumGenerationInput;
}

export function createCurriculumPrompt(
  input: CurriculumPrompt,
): CurriculumPrompt {
  return Object.freeze({
    ...input,
    messages: Object.freeze(
      input.messages.map((message) => Object.freeze(message)),
    ),
    safetyRules: Object.freeze([...input.safetyRules]),
  });
}
