import type { AssembledPrompt } from "@/lib/ai-generation/domain/prompt";

export const FORBIDDEN_COPYRIGHT_VOCABULARY = Object.freeze([
  "康軒",
  "南一",
  "翰林",
  "教師手冊",
  "題庫",
  "解析本",
  "課文引用",
  "課本章節",
  "lesson code",
  "unit mapping",
  "textbook",
  "publisher",
  "edition",
] as const);

export interface CopyrightSafetyValidationResult {
  readonly blockedTerms: readonly string[];
  readonly safe: boolean;
}

export function validateCopyrightSafetyText(
  text: string,
): CopyrightSafetyValidationResult {
  const blockedTerms = FORBIDDEN_COPYRIGHT_VOCABULARY.filter((term) =>
    text.toLowerCase().includes(term.toLowerCase()),
  );
  return Object.freeze({
    blockedTerms: Object.freeze([...blockedTerms]),
    safe: blockedTerms.length === 0,
  });
}

export function validatePromptCopyrightSafety(
  prompt: AssembledPrompt,
): CopyrightSafetyValidationResult {
  return validateCopyrightSafetyText(
    prompt.messages
      .filter((message) => message.role === "user")
      .map((message) => message.content)
      .join("\n"),
  );
}
