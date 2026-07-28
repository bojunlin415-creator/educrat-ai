function normalize(value: unknown, active: WeakSet<object>): unknown {
  if (Array.isArray(value))
    return value.map((entry) => normalize(entry, active));
  if (typeof value !== "object" || value === null) return value;
  if (active.has(value)) {
    throw new TypeError("Cannot serialize circular AI generation value.");
  }
  active.add(value);
  const result = Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalize(entry, active)]),
  );
  active.delete(value);
  return result;
}

export function serializeAiGenerationCanonical(value: unknown): string {
  return JSON.stringify(normalize(value, new WeakSet<object>()));
}
