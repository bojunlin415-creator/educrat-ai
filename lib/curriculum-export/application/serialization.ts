import type { CurriculumExportDocument } from "@/lib/curriculum-export/domain/document";

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortValue(item)]),
    );
  }
  return value;
}

export function serializeCurriculumExportDocument(
  document: CurriculumExportDocument,
): string {
  return JSON.stringify(sortValue(document));
}
