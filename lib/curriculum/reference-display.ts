export type CurriculumReferenceType =
  "CORE" | "CUSTOM" | "REFERENCE" | "SYSTEM";

export interface CurriculumReferenceDisplay {
  code: string;
  displayName: string;
  id: string;
  referenceType: CurriculumReferenceType;
}

interface LegacyReferenceRow {
  code: string;
  id: string;
  name: string;
}

const LEGACY_REFERENCE_DISPLAY: Record<
  string,
  Pick<CurriculumReferenceDisplay, "code" | "displayName" | "referenceType">
> = {
  "nan-yi": {
    code: "teaching-progress-template-1",
    displayName: "教學進度模板 1",
    referenceType: "REFERENCE",
  },
  "kang-hsuan": {
    code: "teaching-progress-template-2",
    displayName: "教學進度模板 2",
    referenceType: "REFERENCE",
  },
  "han-lin": {
    code: "teaching-progress-template-3",
    displayName: "教學進度模板 3",
    referenceType: "REFERENCE",
  },
};

/**
 * AR-001 compatibility boundary.
 *
 * Legacy source identifiers are translated on the server before curriculum
 * data reaches UI or future AI context. The raw source name is intentionally
 * ignored and must never be used as the display label.
 */
export function toCurriculumReferenceDisplay(
  legacyReference: LegacyReferenceRow,
): CurriculumReferenceDisplay {
  const knownReference = LEGACY_REFERENCE_DISPLAY[legacyReference.code];

  return {
    ...(knownReference ?? {
      code: "custom-teaching-progress",
      displayName: "自訂教學進度",
      referenceType: "CUSTOM" as const,
    }),
    id: legacyReference.id,
  };
}

/**
 * Keeps the existing API object shape without disclosing raw source identity.
 * New UI code must use `CurriculumReferenceDisplay` instead.
 */
export function toLegacyReferenceCompatibility(
  reference: CurriculumReferenceDisplay,
) {
  return {
    id: reference.id,
    code: reference.code,
    name: reference.displayName,
  };
}

export function withLegacyReferenceCompatibility<
  T extends { reference: CurriculumReferenceDisplay },
>(curriculum: T) {
  return {
    ...curriculum,
    publisher_id: curriculum.reference.id,
    publisher: toLegacyReferenceCompatibility(curriculum.reference),
  };
}
