import type { LegacyPublisherReference } from "@/lib/ai-curriculum/shared/references";
import { CURRICULUM_REFERENCE_LABELS } from "@/lib/ai-curriculum/shared/references";

export function toNeutralCurriculumReferenceLabel(
  legacyPublisherReference: LegacyPublisherReference | undefined,
): string {
  if (!legacyPublisherReference) return "課綱通用版";
  return CURRICULUM_REFERENCE_LABELS[legacyPublisherReference];
}
