import {
  SUBJECT_CAPABILITIES,
  type SubjectCapability,
  type SubjectCapabilityAvailability,
} from "@/lib/subjects/capabilities";
import { resolveCanonicalSubjectId } from "@/lib/subjects/compatibility";
import {
  CANONICAL_SUBJECT_IDS,
  SUBJECT_CAPABILITY_PROFILE_VERSION,
  type CanonicalSubjectId,
  type SubjectProductMode,
} from "@/lib/subjects/subject-types";

export interface SubjectCapabilityProfile {
  readonly approvedCapabilities: readonly SubjectCapability[];
  readonly availability: Readonly<
    Record<SubjectCapability, SubjectCapabilityAvailability>
  >;
  readonly productMode: SubjectProductMode;
  readonly subjectId: CanonicalSubjectId;
  readonly version: typeof SUBJECT_CAPABILITY_PROFILE_VERSION;
}

export type SubjectCapabilityUiState =
  "AVAILABLE_NOW" | "COMING_LATER" | "NOT_SUPPORTED";

const GENERATION_ONLY_APPROVED = [
  "content_generation",
  "worksheet_generation",
  "assessment_generation",
  "answer_generation",
  "explanation_generation",
  "teacher_editing",
  "pdf_export",
  "word_export",
] as const satisfies readonly SubjectCapability[];

const ENGLISH_APPROVED = [
  ...GENERATION_ONLY_APPROVED,
  "assignment_distribution",
  "online_answering",
  "course_delivery",
  "live_course",
  "recorded_course",
  "automatic_grading",
  "skill_diagnosis",
  "mastery_tracking",
  "personalized_remediation",
  "adaptive_recommendation",
  "progress_reporting",
  "learning_alerts",
  "proficiency_framework",
  "cefr_tracking",
  "exam_preparation",
  "speaking_assessment",
  "pronunciation_assessment",
  "writing_assessment",
  "learning_passport",
] as const satisfies readonly SubjectCapability[];

const MATH_APPROVED = [
  ...GENERATION_ONLY_APPROVED,
  "assignment_distribution",
  "online_answering",
  "automatic_grading",
  "skill_diagnosis",
  "mastery_tracking",
  "misconception_diagnosis",
  "personalized_remediation",
  "adaptive_recommendation",
  "progress_reporting",
  "learning_alerts",
  "knowledge_graph",
  "prerequisite_graph",
  "math_mastery",
  "math_misconception_analysis",
] as const satisfies readonly SubjectCapability[];

const COMMON_IMPLEMENTATION: Readonly<
  Partial<Record<SubjectCapability, SubjectCapabilityAvailability>>
> = Object.freeze({
  answer_generation: "IMPLEMENTED",
  assessment_generation: "PARTIAL",
  content_generation: "IMPLEMENTED",
  explanation_generation: "IMPLEMENTED",
  pdf_export: "IMPLEMENTED",
  teacher_editing: "IMPLEMENTED",
  word_export: "NOT_IMPLEMENTED",
  worksheet_generation: "IMPLEMENTED",
});

const INTELLIGENCE_FOUNDATION_IMPLEMENTATION: Readonly<
  Partial<Record<SubjectCapability, SubjectCapabilityAvailability>>
> = Object.freeze({
  adaptive_recommendation: "PARTIAL",
  assignment_distribution: "PARTIAL",
  mastery_tracking: "PARTIAL",
  online_answering: "PARTIAL",
  personalized_remediation: "PARTIAL",
  progress_reporting: "PARTIAL",
  skill_diagnosis: "PARTIAL",
});

function createAvailability(
  approvedCapabilities: readonly SubjectCapability[],
  implementation: Readonly<
    Partial<Record<SubjectCapability, SubjectCapabilityAvailability>>
  >,
): Readonly<Record<SubjectCapability, SubjectCapabilityAvailability>> {
  const approved = new Set(approvedCapabilities);
  return Object.freeze(
    Object.fromEntries(
      SUBJECT_CAPABILITIES.map((capability) => [
        capability,
        approved.has(capability)
          ? (implementation[capability] ?? "NOT_IMPLEMENTED")
          : "NOT_IMPLEMENTED",
      ]),
    ) as Record<SubjectCapability, SubjectCapabilityAvailability>,
  );
}

function createProfile(input: {
  readonly approvedCapabilities: readonly SubjectCapability[];
  readonly implementation?: Readonly<
    Partial<Record<SubjectCapability, SubjectCapabilityAvailability>>
  >;
  readonly productMode: SubjectProductMode;
  readonly subjectId: CanonicalSubjectId;
}): SubjectCapabilityProfile {
  const approvedCapabilities = Object.freeze([...input.approvedCapabilities]);
  return Object.freeze({
    approvedCapabilities,
    availability: createAvailability(
      approvedCapabilities,
      Object.freeze({
        ...COMMON_IMPLEMENTATION,
        ...input.implementation,
      }),
    ),
    productMode: input.productMode,
    subjectId: input.subjectId,
    version: SUBJECT_CAPABILITY_PROFILE_VERSION,
  });
}

const intelligenceImplementation = Object.freeze({
  ...INTELLIGENCE_FOUNDATION_IMPLEMENTATION,
});

export const SUBJECT_CAPABILITY_REGISTRY: Readonly<
  Record<CanonicalSubjectId, SubjectCapabilityProfile>
> = Object.freeze({
  chinese: createProfile({
    approvedCapabilities: GENERATION_ONLY_APPROVED,
    productMode: "GENERATION_ONLY",
    subjectId: "chinese",
  }),
  english: createProfile({
    approvedCapabilities: ENGLISH_APPROVED,
    implementation: intelligenceImplementation,
    productMode: "ENGLISH_INTELLIGENCE_PLATFORM",
    subjectId: "english",
  }),
  life_curriculum: createProfile({
    approvedCapabilities: GENERATION_ONLY_APPROVED,
    productMode: "GENERATION_ONLY",
    subjectId: "life_curriculum",
  }),
  math: createProfile({
    approvedCapabilities: MATH_APPROVED,
    implementation: intelligenceImplementation,
    productMode: "MATH_INTELLIGENCE_PLATFORM",
    subjectId: "math",
  }),
  science: createProfile({
    approvedCapabilities: GENERATION_ONLY_APPROVED,
    productMode: "GENERATION_ONLY",
    subjectId: "science",
  }),
  social_studies: createProfile({
    approvedCapabilities: GENERATION_ONLY_APPROVED,
    productMode: "GENERATION_ONLY",
    subjectId: "social_studies",
  }),
});

export function getSubjectCapabilityProfile(
  subject: unknown,
): SubjectCapabilityProfile | null {
  const canonicalSubject = resolveCanonicalSubjectId(subject);
  return canonicalSubject
    ? SUBJECT_CAPABILITY_REGISTRY[canonicalSubject]
    : null;
}

export function isSubjectCapabilityApproved(
  subject: unknown,
  capability: unknown,
): boolean {
  const profile = getSubjectCapabilityProfile(subject);
  return (
    profile !== null &&
    typeof capability === "string" &&
    profile.approvedCapabilities.includes(capability as SubjectCapability)
  );
}

export function getSubjectCapabilityAvailability(
  subject: unknown,
  capability: unknown,
): SubjectCapabilityAvailability | null {
  const profile = getSubjectCapabilityProfile(subject);
  if (
    !profile ||
    typeof capability !== "string" ||
    !SUBJECT_CAPABILITIES.includes(capability as SubjectCapability)
  ) {
    return null;
  }
  return profile.availability[capability as SubjectCapability];
}

export function isSubjectCapabilityAvailable(
  subject: unknown,
  capability: unknown,
): boolean {
  return (
    isSubjectCapabilityApproved(subject, capability) &&
    getSubjectCapabilityAvailability(subject, capability) === "IMPLEMENTED"
  );
}

export function getSubjectCapabilityUiState(
  subject: unknown,
  capability: unknown,
): SubjectCapabilityUiState {
  if (isSubjectCapabilityAvailable(subject, capability)) {
    return "AVAILABLE_NOW";
  }
  return isSubjectCapabilityApproved(subject, capability)
    ? "COMING_LATER"
    : "NOT_SUPPORTED";
}

export function listSubjectCapabilityProfiles(): readonly SubjectCapabilityProfile[] {
  return Object.freeze(
    CANONICAL_SUBJECT_IDS.map(
      (subjectId) => SUBJECT_CAPABILITY_REGISTRY[subjectId],
    ),
  );
}
