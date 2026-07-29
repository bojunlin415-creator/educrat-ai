import {
  CURRICULUM_EXPORT_MODES,
  type CurriculumExportMode,
} from "@/lib/curriculum-export/domain/document";

export function isCurriculumExportMode(
  value: string | null,
): value is CurriculumExportMode {
  return (
    value !== null &&
    CURRICULUM_EXPORT_MODES.includes(value as CurriculumExportMode)
  );
}

export function getCurriculumExportModeLabel(mode: CurriculumExportMode) {
  switch (mode) {
    case "worksheet":
      return "題目卷";
    case "answer-sheet":
      return "解答卷";
    case "combined":
      return "題目與解答";
  }
}
