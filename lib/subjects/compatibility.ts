import {
  CANONICAL_SUBJECT_IDS,
  type CanonicalSubjectId,
} from "@/lib/subjects/subject-types";

/**
 * Sprint 7 seeded `social` and `life`. CAP-001 keeps those stable database
 * values as explicit aliases without treating display labels as identity.
 */
export const LEGACY_SUBJECT_ID_ALIASES = Object.freeze({
  life: "life_curriculum",
  social: "social_studies",
} as const satisfies Readonly<Record<string, CanonicalSubjectId>>);

const canonicalSubjectIdSet = new Set<string>(CANONICAL_SUBJECT_IDS);
const legacySubjectIdAliasLookup: Readonly<Record<string, CanonicalSubjectId>> =
  LEGACY_SUBJECT_ID_ALIASES;

export function resolveCanonicalSubjectId(
  value: unknown,
): CanonicalSubjectId | null {
  if (typeof value !== "string") return null;
  if (canonicalSubjectIdSet.has(value)) return value as CanonicalSubjectId;
  return legacySubjectIdAliasLookup[value] ?? null;
}
