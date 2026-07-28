export const AI_CURRICULUM_CONTRACT_VERSION = 1 as const;

export type AiCurriculumContractVersion = typeof AI_CURRICULUM_CONTRACT_VERSION;

export const ELEMENTARY_GRADES = [1, 2, 3, 4, 5, 6] as const;

export type ElementaryGrade = (typeof ELEMENTARY_GRADES)[number];

export const CURRICULUM_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

export type CurriculumDifficulty = (typeof CURRICULUM_DIFFICULTIES)[number];

export const LEGACY_PUBLISHER_REFERENCES = [
  "NAN_YI",
  "KANG_HSUAN",
  "HAN_LIN",
] as const;

export type LegacyPublisherReference =
  (typeof LEGACY_PUBLISHER_REFERENCES)[number];

export const CURRICULUM_REFERENCE_LABELS: Record<
  LegacyPublisherReference,
  string
> = Object.freeze({
  HAN_LIN: "教學進度模板 3",
  KANG_HSUAN: "教學進度模板 2",
  NAN_YI: "教學進度模板 1",
});

export const PRINT_PAGE_SIZES = ["A4"] as const;

export type PrintPageSize = (typeof PRINT_PAGE_SIZES)[number];

export const PRINT_EXPORT_TARGETS = ["PDF"] as const;

export type PrintExportTarget = (typeof PRINT_EXPORT_TARGETS)[number];

export const QUESTION_TYPES = ["EXERCISE", "CHALLENGE"] as const;

export type CurriculumQuestionType = (typeof QUESTION_TYPES)[number];

export type KnowledgePointId = string;
export type CurriculumQuestionId = string;
