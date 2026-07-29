import {
  CURRICULUM_EXPORT_MODES,
  type CurriculumExportDocument,
} from "@/lib/curriculum-export/domain/document";

export interface CurriculumExportValidationResult {
  readonly reason?: string;
  readonly success: boolean;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hasText(value: string) {
  return value.trim().length > 0 && value.length <= 300;
}

export function validateCurriculumExportDocument(
  document: CurriculumExportDocument,
): CurriculumExportValidationResult {
  if (document.version !== 1) {
    return Object.freeze({ reason: "unsupported_version", success: false });
  }
  if (!CURRICULUM_EXPORT_MODES.includes(document.mode)) {
    return Object.freeze({ reason: "invalid_mode", success: false });
  }
  if (
    !UUID_PATTERN.test(document.metadata.curriculumId) ||
    !UUID_PATTERN.test(document.metadata.curriculumVersionId)
  ) {
    return Object.freeze({ reason: "invalid_identifier", success: false });
  }
  if (
    !hasText(document.metadata.organizationName) ||
    !hasText(document.metadata.title) ||
    !hasText(document.metadata.subject) ||
    !hasText(document.metadata.grade)
  ) {
    return Object.freeze({ reason: "invalid_metadata", success: false });
  }
  const questionNumbers = new Set<number>();
  for (const section of document.sections) {
    if (!hasText(section.heading)) {
      return Object.freeze({ reason: "invalid_section", success: false });
    }
    if (!section.questions) continue;
    for (const question of section.questions) {
      if (!hasText(question.prompt) || questionNumbers.has(question.number)) {
        return Object.freeze({ reason: "invalid_question", success: false });
      }
      questionNumbers.add(question.number);
      if (
        document.mode !== "worksheet" &&
        (!question.answer || !hasText(question.answer.value))
      ) {
        return Object.freeze({ reason: "missing_answer", success: false });
      }
    }
  }
  return Object.freeze({ success: true });
}
