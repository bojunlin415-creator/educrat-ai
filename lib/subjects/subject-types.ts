export const SUBJECT_CAPABILITY_PROFILE_VERSION = "cap-001.v1" as const;

export const CANONICAL_SUBJECT_IDS = [
  "english",
  "math",
  "chinese",
  "science",
  "social_studies",
  "life_curriculum",
] as const;

export type CanonicalSubjectId = (typeof CANONICAL_SUBJECT_IDS)[number];

export const SUBJECT_PRODUCT_MODES = [
  "ENGLISH_INTELLIGENCE_PLATFORM",
  "MATH_INTELLIGENCE_PLATFORM",
  "GENERATION_ONLY",
] as const;

export type SubjectProductMode = (typeof SUBJECT_PRODUCT_MODES)[number];
