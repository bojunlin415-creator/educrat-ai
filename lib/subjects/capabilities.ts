export const CONTENT_AUTHORING_CAPABILITIES = [
  "content_generation",
  "worksheet_generation",
  "assessment_generation",
  "answer_generation",
  "explanation_generation",
  "teacher_editing",
  "pdf_export",
  "word_export",
] as const;

export const LEARNING_DELIVERY_CAPABILITIES = [
  "assignment_distribution",
  "online_answering",
  "course_delivery",
  "live_course",
  "recorded_course",
] as const;

export const GRADING_INTELLIGENCE_CAPABILITIES = [
  "automatic_grading",
  "skill_diagnosis",
  "mastery_tracking",
  "misconception_diagnosis",
  "personalized_remediation",
  "adaptive_recommendation",
  "progress_reporting",
  "learning_alerts",
] as const;

export const ENGLISH_FUTURE_INTELLIGENCE_CAPABILITIES = [
  "proficiency_framework",
  "cefr_tracking",
  "exam_preparation",
  "speaking_assessment",
  "pronunciation_assessment",
  "writing_assessment",
  "learning_passport",
] as const;

export const MATH_FUTURE_INTELLIGENCE_CAPABILITIES = [
  "knowledge_graph",
  "prerequisite_graph",
  "math_mastery",
  "math_misconception_analysis",
] as const;

export const SUBJECT_CAPABILITIES = [
  ...CONTENT_AUTHORING_CAPABILITIES,
  ...LEARNING_DELIVERY_CAPABILITIES,
  ...GRADING_INTELLIGENCE_CAPABILITIES,
  ...ENGLISH_FUTURE_INTELLIGENCE_CAPABILITIES,
  ...MATH_FUTURE_INTELLIGENCE_CAPABILITIES,
] as const;

export type SubjectCapability = (typeof SUBJECT_CAPABILITIES)[number];

export const SUBJECT_CAPABILITY_AVAILABILITIES = [
  "IMPLEMENTED",
  "PARTIAL",
  "NOT_IMPLEMENTED",
] as const;

export type SubjectCapabilityAvailability =
  (typeof SUBJECT_CAPABILITY_AVAILABILITIES)[number];

const subjectCapabilitySet = new Set<string>(SUBJECT_CAPABILITIES);

export function isSubjectCapability(
  value: unknown,
): value is SubjectCapability {
  return typeof value === "string" && subjectCapabilitySet.has(value);
}
