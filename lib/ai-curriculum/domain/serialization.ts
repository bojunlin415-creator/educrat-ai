function sortCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortCanonicalValue);
  if (typeof value !== "object" || value === null) return value;

  const record = value as Readonly<Record<string, unknown>>;
  return Object.keys(record)
    .sort()
    .reduce<Record<string, unknown>>((result, key) => {
      result[key] = sortCanonicalValue(record[key]);
      return result;
    }, {});
}

export function serializeCurriculumArtifact(value: unknown): string {
  return JSON.stringify(sortCanonicalValue(value));
}
