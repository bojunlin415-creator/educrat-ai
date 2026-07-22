import type { AuditEventHashMaterial } from "@/lib/audit/domain/audit-event";
import { AuditError } from "@/lib/audit/domain/error";
import type { CanonicalAuditPayload } from "@/lib/audit/shared/references";

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
      throw new AuditError("AUDIT_SERIALIZATION_FAILED");
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (typeof value !== "object") {
    throw new AuditError("AUDIT_SERIALIZATION_FAILED");
  }
  if (active.has(value)) {
    throw new AuditError("AUDIT_SERIALIZATION_FAILED");
  }
  active.add(value);

  try {
    if (Array.isArray(value)) {
      return Object.freeze(value.map((item) => canonicalize(item, active)));
    }
    const prototype = Object.getPrototypeOf(value) as unknown;
    if (prototype !== Object.prototype && prototype !== null) {
      throw new AuditError("AUDIT_SERIALIZATION_FAILED");
    }
    if (Object.getOwnPropertySymbols(value).length > 0) {
      throw new AuditError("AUDIT_SERIALIZATION_FAILED");
    }

    const descriptors = Object.getOwnPropertyDescriptors(value);
    const result: Record<string, CanonicalValue> = {};
    for (const key of Object.keys(descriptors).sort()) {
      const descriptor = descriptors[key];
      if (!descriptor || descriptor.get || descriptor.set) {
        throw new AuditError("AUDIT_SERIALIZATION_FAILED");
      }
      result[key] = canonicalize(descriptor.value, active);
    }
    return Object.freeze(result);
  } finally {
    active.delete(value);
  }
}

export function canonicalSerialize(value: unknown): CanonicalAuditPayload {
  const serialized = JSON.stringify(canonicalize(value, new WeakSet()));
  return serialized as CanonicalAuditPayload;
}

export function serializeAuditEventForHash(
  event: AuditEventHashMaterial,
): CanonicalAuditPayload {
  return canonicalSerialize(event);
}
