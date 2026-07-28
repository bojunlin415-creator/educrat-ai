import type { RecycleBinRegistryDefinition } from "@/lib/recycle-bin/domain/definition";
import type { RecycleEntry } from "@/lib/recycle-bin/domain/entry";
import type {
  PermanentDeletionRequest,
  RestoreRequest,
} from "@/lib/recycle-bin/domain/request";
import type {
  PermanentDeletionDecision,
  PurgeEligibility,
  RestoreDecision,
} from "@/lib/recycle-bin/domain/result";

type RecycleBinSerializable =
  | PermanentDeletionDecision
  | PermanentDeletionRequest
  | PurgeEligibility
  | RecycleBinRegistryDefinition
  | RecycleEntry
  | RestoreDecision
  | RestoreRequest;

function normalize(value: unknown, active: WeakSet<object>): unknown {
  if (Array.isArray(value))
    return value.map((entry) => normalize(entry, active));
  if (typeof value !== "object" || value === null) return value;
  if (active.has(value)) {
    throw new TypeError("Cannot serialize circular recycle bin value.");
  }
  active.add(value);
  const normalized = Object.fromEntries(
    Object.entries(value)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, normalize(entry, active)]),
  );
  active.delete(value);
  return normalized;
}

export function serializeRecycleBinCanonical(
  value: RecycleBinSerializable,
): string {
  return JSON.stringify(normalize(value, new WeakSet<object>()));
}
