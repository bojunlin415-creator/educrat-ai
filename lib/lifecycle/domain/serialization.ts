import { LifecycleError } from "@/lib/lifecycle/domain/error";
import { validateLifecycleDefinition } from "@/lib/lifecycle/domain/validation";
import type { CanonicalLifecyclePayload } from "@/lib/lifecycle/shared/references";

type CanonicalPrimitive = null | boolean | number | string;

interface CanonicalObject {
  readonly [key: string]: CanonicalValue;
}

interface CanonicalArray {
  readonly [index: number]: CanonicalValue;
  readonly length: number;
}

type CanonicalValue = CanonicalPrimitive | CanonicalArray | CanonicalObject;

function canonicalize(value: unknown, active: WeakSet<object>): CanonicalValue {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") return value.normalize("NFC");
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new LifecycleError("INVALID_LIFECYCLE_INPUT");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object" || active.has(value)) {
    throw new LifecycleError("INVALID_LIFECYCLE_INPUT");
  }

  active.add(value);
  try {
    if (Array.isArray(value)) {
      return Object.freeze(value.map((item) => canonicalize(item, active)));
    }
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new LifecycleError("INVALID_LIFECYCLE_INPUT");
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new LifecycleError("INVALID_LIFECYCLE_INPUT");
    }

    const result: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(value).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || descriptor.get || descriptor.set) {
        throw new LifecycleError("INVALID_LIFECYCLE_INPUT");
      }
      result[key] = canonicalize(descriptor.value, active);
    }
    return Object.freeze(result);
  } finally {
    active.delete(value);
  }
}

export function serializeLifecycleDefinition(
  input: unknown,
): CanonicalLifecyclePayload {
  const definition = validateLifecycleDefinition(input);
  return JSON.stringify(
    canonicalize(definition, new WeakSet()),
  ) as CanonicalLifecyclePayload;
}
