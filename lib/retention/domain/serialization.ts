import type {
  RetentionDefinition,
  RetentionRegistryDefinition,
} from "@/lib/retention/domain/definition";
import { RetentionError } from "@/lib/retention/domain/error";
import {
  hasExactRetentionKeys,
  isPlainRetentionRecord,
  validateLegalHoldReferences,
  validateRetentionCheckRequest,
  validateRetentionDefinition,
} from "@/lib/retention/domain/validation";
import type { CanonicalRetentionPayload } from "@/lib/retention/shared/references";

type CanonicalPrimitive = null | boolean | number | string;

interface CanonicalObject {
  readonly [key: string]: CanonicalValue;
}

interface CanonicalArray {
  readonly [index: number]: CanonicalValue;
  readonly length: number;
}

type CanonicalValue = CanonicalPrimitive | CanonicalArray | CanonicalObject;

const SNAPSHOT_KEYS = ["definition", "legalHolds", "request"] as const;

function canonicalize(value: unknown, active: WeakSet<object>): CanonicalValue {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return value.normalize("NFC");
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new RetentionError("INVALID_RETENTION_INPUT");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object" || active.has(value)) {
    throw new RetentionError("INVALID_RETENTION_INPUT");
  }

  active.add(value);
  try {
    if (Array.isArray(value)) {
      return Object.freeze(value.map((item) => canonicalize(item, active)));
    }
    if (!isPlainRetentionRecord(value)) {
      throw new RetentionError("INVALID_RETENTION_INPUT");
    }
    const result: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = canonicalize(value[key], active);
    }
    return Object.freeze(result);
  } finally {
    active.delete(value);
  }
}

function definitionsMatch(
  left: RetentionDefinition,
  right: RetentionDefinition,
): boolean {
  return (
    JSON.stringify(canonicalize(left, new WeakSet())) ===
    JSON.stringify(canonicalize(right, new WeakSet()))
  );
}

export function serializeRetentionSnapshot(
  input: unknown,
  registry: RetentionRegistryDefinition,
): CanonicalRetentionPayload {
  if (
    !isPlainRetentionRecord(input) ||
    !hasExactRetentionKeys(input, SNAPSHOT_KEYS)
  ) {
    throw new RetentionError("INVALID_RETENTION_INPUT");
  }
  const request = validateRetentionCheckRequest(input.request, registry);
  const canonicalDefinition = registry.definitions.find(
    (definition) => definition.resourceType === request.resourceType,
  );
  if (!canonicalDefinition) {
    throw new RetentionError("UNKNOWN_RETENTION_RESOURCE");
  }
  const definition = validateRetentionDefinition(
    input.definition,
    registry.retentionCategories,
  );
  if (
    definition.resourceType !== request.resourceType ||
    !definitionsMatch(definition, canonicalDefinition)
  ) {
    throw new RetentionError("INVALID_RETENTION_RULE");
  }
  const legalHolds = validateLegalHoldReferences(
    input.legalHolds,
    request,
    definition,
  );

  return JSON.stringify(
    canonicalize({ definition, legalHolds, request }, new WeakSet()),
  ) as CanonicalRetentionPayload;
}
