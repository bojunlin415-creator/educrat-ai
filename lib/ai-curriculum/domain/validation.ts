export const CURRICULUM_VALIDATION_CODES = [
  "INVALID_INPUT",
  "INVALID_CURRICULUM",
  "INVALID_LAYOUT",
  "MISSING_REQUIRED_FIELD",
  "INVALID_DIFFICULTY",
  "INVALID_QUESTION_COUNT",
  "MISSING_KNOWLEDGE_MAPPING",
  "UNKNOWN_KNOWLEDGE_POINT",
  "INCOMPLETE_LAYOUT",
] as const;

export type CurriculumValidationCode =
  (typeof CURRICULUM_VALIDATION_CODES)[number];

export interface CurriculumValidationIssue {
  readonly code: CurriculumValidationCode;
  readonly path: string;
}

export interface CurriculumValidationResult {
  readonly issues: readonly CurriculumValidationIssue[];
  readonly valid: boolean;
}

export function createValidationResult(
  issues: readonly CurriculumValidationIssue[],
): CurriculumValidationResult {
  return Object.freeze({
    issues: Object.freeze(issues.map((issue) => Object.freeze({ ...issue }))),
    valid: issues.length === 0,
  });
}
