export const AI_CURRICULUM_CONTRACT_VERSION = 1 as const;

export type AiCurriculumContractVersion = typeof AI_CURRICULUM_CONTRACT_VERSION;

export const ELEMENTARY_GRADES = [1, 2, 3, 4, 5, 6] as const;

export type ElementaryGrade = (typeof ELEMENTARY_GRADES)[number];

export const CURRICULUM_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

export type CurriculumDifficulty = (typeof CURRICULUM_DIFFICULTIES)[number];

export const LEARNING_STAGES = [
  "LOWER_ELEMENTARY",
  "MIDDLE_ELEMENTARY",
  "UPPER_ELEMENTARY",
] as const;

export type LearningStage = (typeof LEARNING_STAGES)[number];

export const PRINT_PAGE_SIZES = ["A4"] as const;

export type PrintPageSize = (typeof PRINT_PAGE_SIZES)[number];

export const PRINT_EXPORT_TARGETS = ["PDF"] as const;

export type PrintExportTarget = (typeof PRINT_EXPORT_TARGETS)[number];

export const QUESTION_TYPES = ["EXERCISE", "CHALLENGE"] as const;

export type CurriculumQuestionType = (typeof QUESTION_TYPES)[number];

export type KnowledgePointId = string;
export type CurriculumQuestionId = string;
