import type { DependencyDefinition } from "@/lib/dependency/domain/definition";
import { DependencyError } from "@/lib/dependency/domain/error";
import {
  validateDependencyCheckRequest,
  validateDependencyReferences,
} from "@/lib/dependency/domain/validation";
import type { CanonicalDependencyPayload } from "@/lib/dependency/shared/references";

type CanonicalPrimitive = null | boolean | number | string;

interface CanonicalObject {
  readonly [key: string]: CanonicalValue;
}

interface CanonicalArray {
  readonly [index: number]: CanonicalValue;
  readonly length: number;
}

type CanonicalValue = CanonicalPrimitive | CanonicalArray | CanonicalObject;

const SNAPSHOT_KEYS = ["dependencies", "request"] as const;

function isPlainRecord(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) return false;
  if (Object.getOwnPropertySymbols(value).length > 0) return false;
  return Object.values(Object.getOwnPropertyDescriptors(value)).every(
    (descriptor) =>
      descriptor.get === undefined && descriptor.set === undefined,
  );
}

function hasExactKeys(
  value: Readonly<Record<string, unknown>>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const normalizedExpected = [...expected].sort();
  return (
    actual.length === normalizedExpected.length &&
    actual.every((key, index) => key === normalizedExpected[index])
  );
}

function canonicalize(value: unknown, active: WeakSet<object>): CanonicalValue {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return value.normalize("NFC");
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new DependencyError("INVALID_DEPENDENCY_INPUT");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object" || active.has(value)) {
    throw new DependencyError("INVALID_DEPENDENCY_INPUT");
  }

  active.add(value);
  try {
    if (Array.isArray(value)) {
      return Object.freeze(value.map((item) => canonicalize(item, active)));
    }
    if (!isPlainRecord(value)) {
      throw new DependencyError("INVALID_DEPENDENCY_INPUT");
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

export function serializeDependencySnapshot(
  input: unknown,
  definition: DependencyDefinition,
): CanonicalDependencyPayload {
  if (!isPlainRecord(input) || !hasExactKeys(input, SNAPSHOT_KEYS)) {
    throw new DependencyError("INVALID_DEPENDENCY_INPUT");
  }
  const request = validateDependencyCheckRequest(input.request, definition);
  const dependencies = validateDependencyReferences(
    input.dependencies,
    request,
    definition,
  );
  return JSON.stringify(
    canonicalize({ dependencies, request }, new WeakSet()),
  ) as CanonicalDependencyPayload;
}
