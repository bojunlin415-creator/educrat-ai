import type { ReAuthenticationChallenge } from "@/lib/re-authentication/domain/challenge";
import type {
  ReAuthenticationRegistryDefinition,
  ReAuthenticationRequirement,
} from "@/lib/re-authentication/domain/definition";
import type { ReAuthenticationCheckRequest } from "@/lib/re-authentication/domain/request";
import type { ReAuthenticationDecision } from "@/lib/re-authentication/domain/result";

type ReAuthenticationSerializable =
  | ReAuthenticationChallenge
  | ReAuthenticationCheckRequest
  | ReAuthenticationDecision
  | ReAuthenticationRegistryDefinition
  | ReAuthenticationRequirement;

function normalize(value: unknown, active: WeakSet<object>): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalize(entry, active));
  }
  if (typeof value !== "object" || value === null) return value;
  if (active.has(value)) {
    throw new TypeError("Cannot serialize circular re-authentication value.");
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

export function serializeReAuthenticationCanonical(
  value: ReAuthenticationSerializable,
): string {
  return JSON.stringify(normalize(value, new WeakSet<object>()));
}
