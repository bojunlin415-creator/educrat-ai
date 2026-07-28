import {
  RECYCLE_BIN_CONTRACT_VERSION,
  RECYCLE_BIN_LIFECYCLE_STATES,
  type RecycleBinContractVersion,
  type RecycleBinLifecycleState,
  type RecycleBinRegistryDefinition,
} from "@/lib/recycle-bin/domain/definition";
import type {
  RecycleBinMetadataEntry,
  RecycleBinMetadataValue,
  RecycleEntry,
} from "@/lib/recycle-bin/domain/entry";
import {
  RecycleBinError,
  type RecycleBinErrorCode,
} from "@/lib/recycle-bin/domain/error";
import type { RecycleBinPolicyResult } from "@/lib/recycle-bin/domain/policy";
import type {
  PermanentDeletionRequest,
  RestoreRequest,
} from "@/lib/recycle-bin/domain/request";
import type {
  RecycleBinActorId,
  RecycleBinDependencyReference,
  RecycleBinLegalHoldReference,
  RecycleBinMetadataCode,
  RecycleBinOrganizationId,
  RecycleBinRecycleId,
  RecycleBinResourceId,
  RecycleBinResourceType,
  RecycleBinRetentionReference,
  RecycleBinTransition,
} from "@/lib/recycle-bin/shared/references";

const RECYCLE_BIN_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,127}$/;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const MAX_RECYCLE_BIN_METADATA_ENTRIES = 16;
const MAX_RECYCLE_BIN_VOCABULARY = 1_000;
const MAX_METADATA_NUMBER = 1_000_000_000;

const REGISTRY_KEYS = ["resourceTypes", "transitions", "version"] as const;
const METADATA_ENTRY_KEYS = ["key", "value"] as const;
const ENTRY_KEYS = [
  "deletedAt",
  "deletedBy",
  "dependencyReference",
  "legalHoldReference",
  "lifecycleState",
  "metadata",
  "organizationId",
  "permanentDeleteEligible",
  "recycleId",
  "resourceId",
  "resourceType",
  "restoreEligible",
  "retentionReference",
  "retentionUntil",
  "version",
] as const;
const RESTORE_REQUEST_KEYS = [
  "requestedBy",
  "resourceId",
  "resourceType",
  "version",
] as const;
const PERMANENT_DELETION_REQUEST_KEYS = [
  "requestedBy",
  "requestedTransition",
  "resourceId",
  "resourceType",
  "version",
] as const;

export function isPlainRecycleBinRecord(
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

export function hasExactRecycleBinKeys(
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

function parseCode(value: unknown, errorCode: RecycleBinErrorCode): string {
  if (typeof value !== "string" || !RECYCLE_BIN_CODE_PATTERN.test(value)) {
    throw new RecycleBinError(errorCode);
  }
  return value;
}

function parseIdentifier(
  value: unknown,
  errorCode: RecycleBinErrorCode,
): string {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw new RecycleBinError(errorCode);
  }
  return value;
}

function parseVersion(value: unknown): RecycleBinContractVersion {
  if (value !== RECYCLE_BIN_CONTRACT_VERSION) {
    throw new RecycleBinError("UNSUPPORTED_RECYCLE_BIN_VERSION");
  }
  return RECYCLE_BIN_CONTRACT_VERSION;
}

function parseIsoInstant(
  value: unknown,
  errorCode: RecycleBinErrorCode,
): string {
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value)) {
    throw new RecycleBinError(errorCode);
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) throw new RecycleBinError(errorCode);
  return value;
}

function parseUniqueCodes<T extends string>(
  value: unknown,
  unknownCode: RecycleBinErrorCode,
  duplicateCode: RecycleBinErrorCode,
): readonly T[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > MAX_RECYCLE_BIN_VOCABULARY
  ) {
    throw new RecycleBinError(unknownCode);
  }
  const parsed = value.map((entry) => parseCode(entry, unknownCode) as T);
  if (new Set(parsed).size !== parsed.length) {
    throw new RecycleBinError(duplicateCode);
  }
  return Object.freeze([...parsed].sort());
}

function parseMetadataValue(value: unknown): RecycleBinMetadataValue {
  if (typeof value === "boolean") return value;
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_METADATA_NUMBER
  ) {
    return value;
  }
  return parseCode(
    value,
    "INVALID_RECYCLE_BIN_ENTRY",
  ) as RecycleBinMetadataCode;
}

function parseMetadata(input: unknown): readonly RecycleBinMetadataEntry[] {
  if (
    !Array.isArray(input) ||
    input.length > MAX_RECYCLE_BIN_METADATA_ENTRIES
  ) {
    throw new RecycleBinError("INVALID_RECYCLE_BIN_ENTRY");
  }
  const metadata = input.map((entry) => {
    if (
      !isPlainRecycleBinRecord(entry) ||
      !hasExactRecycleBinKeys(entry, METADATA_ENTRY_KEYS)
    ) {
      throw new RecycleBinError("INVALID_RECYCLE_BIN_ENTRY");
    }
    return Object.freeze({
      key: parseCode(
        entry.key,
        "INVALID_RECYCLE_BIN_ENTRY",
      ) as RecycleBinMetadataCode,
      value: parseMetadataValue(entry.value),
    });
  });
  const keys = metadata.map((entry) => entry.key);
  if (new Set(keys).size !== keys.length) {
    throw new RecycleBinError("INVALID_RECYCLE_BIN_ENTRY");
  }
  return Object.freeze(
    [...metadata].sort((left, right) => left.key.localeCompare(right.key)),
  );
}

export function validateRecycleBinRegistryDefinition(
  input: unknown,
): RecycleBinRegistryDefinition {
  if (
    !isPlainRecycleBinRecord(input) ||
    !hasExactRecycleBinKeys(input, REGISTRY_KEYS)
  ) {
    throw new RecycleBinError("INVALID_RECYCLE_BIN_INPUT");
  }
  return Object.freeze({
    resourceTypes: parseUniqueCodes<RecycleBinResourceType>(
      input.resourceTypes,
      "UNKNOWN_RECYCLE_BIN_RESOURCE",
      "DUPLICATE_RECYCLE_BIN_RESOURCE_TYPE",
    ),
    transitions: parseUniqueCodes<RecycleBinTransition>(
      input.transitions,
      "UNKNOWN_RECYCLE_BIN_TRANSITION",
      "DUPLICATE_RECYCLE_BIN_TRANSITION",
    ),
    version: parseVersion(input.version),
  });
}

export function validateRecycleEntry(
  input: unknown,
  definition: RecycleBinRegistryDefinition,
): RecycleEntry {
  if (
    !isPlainRecycleBinRecord(input) ||
    !hasExactRecycleBinKeys(input, ENTRY_KEYS)
  ) {
    throw new RecycleBinError("INVALID_RECYCLE_BIN_ENTRY");
  }
  const resourceType = parseCode(
    input.resourceType,
    "UNKNOWN_RECYCLE_BIN_RESOURCE",
  ) as RecycleBinResourceType;
  if (!(definition.resourceTypes as readonly string[]).includes(resourceType)) {
    throw new RecycleBinError("UNKNOWN_RECYCLE_BIN_RESOURCE");
  }
  if (
    typeof input.lifecycleState !== "string" ||
    !(RECYCLE_BIN_LIFECYCLE_STATES as readonly string[]).includes(
      input.lifecycleState,
    ) ||
    typeof input.restoreEligible !== "boolean" ||
    typeof input.permanentDeleteEligible !== "boolean"
  ) {
    throw new RecycleBinError("INVALID_RECYCLE_BIN_ENTRY");
  }
  const deletedAt = parseIsoInstant(
    input.deletedAt,
    "INVALID_RECYCLE_BIN_ENTRY",
  );
  const retentionUntil = parseIsoInstant(
    input.retentionUntil,
    "INVALID_RECYCLE_BIN_ENTRY",
  );
  if (Date.parse(retentionUntil) < Date.parse(deletedAt)) {
    throw new RecycleBinError("INVALID_RECYCLE_BIN_ENTRY");
  }

  return Object.freeze({
    deletedAt,
    deletedBy: parseIdentifier(
      input.deletedBy,
      "INVALID_RECYCLE_BIN_ENTRY",
    ) as RecycleBinActorId,
    dependencyReference: parseIdentifier(
      input.dependencyReference,
      "INVALID_RECYCLE_BIN_ENTRY",
    ) as RecycleBinDependencyReference,
    legalHoldReference: parseIdentifier(
      input.legalHoldReference,
      "INVALID_RECYCLE_BIN_ENTRY",
    ) as RecycleBinLegalHoldReference,
    lifecycleState: input.lifecycleState as RecycleBinLifecycleState,
    metadata: parseMetadata(input.metadata),
    organizationId: parseIdentifier(
      input.organizationId,
      "INVALID_RECYCLE_BIN_ENTRY",
    ) as RecycleBinOrganizationId,
    permanentDeleteEligible: input.permanentDeleteEligible,
    recycleId: parseIdentifier(
      input.recycleId,
      "INVALID_RECYCLE_BIN_ENTRY",
    ) as RecycleBinRecycleId,
    resourceId: parseIdentifier(
      input.resourceId,
      "INVALID_RECYCLE_BIN_ENTRY",
    ) as RecycleBinResourceId,
    resourceType,
    restoreEligible: input.restoreEligible,
    retentionReference: parseIdentifier(
      input.retentionReference,
      "INVALID_RECYCLE_BIN_ENTRY",
    ) as RecycleBinRetentionReference,
    retentionUntil,
    version: parseVersion(input.version),
  });
}

export function validateRestoreRequest(
  input: unknown,
  definition: RecycleBinRegistryDefinition,
): RestoreRequest {
  if (
    !isPlainRecycleBinRecord(input) ||
    !hasExactRecycleBinKeys(input, RESTORE_REQUEST_KEYS)
  ) {
    throw new RecycleBinError("INVALID_RECYCLE_BIN_REQUEST");
  }
  const resourceType = parseCode(
    input.resourceType,
    "UNKNOWN_RECYCLE_BIN_RESOURCE",
  ) as RecycleBinResourceType;
  if (!(definition.resourceTypes as readonly string[]).includes(resourceType)) {
    throw new RecycleBinError("UNKNOWN_RECYCLE_BIN_RESOURCE");
  }
  return Object.freeze({
    requestedBy: parseIdentifier(
      input.requestedBy,
      "INVALID_RECYCLE_BIN_REQUEST",
    ) as RecycleBinActorId,
    resourceId: parseIdentifier(
      input.resourceId,
      "INVALID_RECYCLE_BIN_REQUEST",
    ) as RecycleBinResourceId,
    resourceType,
    version: parseVersion(input.version),
  });
}

export function validatePermanentDeletionRequest(
  input: unknown,
  definition: RecycleBinRegistryDefinition,
): PermanentDeletionRequest {
  if (
    !isPlainRecycleBinRecord(input) ||
    !hasExactRecycleBinKeys(input, PERMANENT_DELETION_REQUEST_KEYS)
  ) {
    throw new RecycleBinError("INVALID_RECYCLE_BIN_REQUEST");
  }
  const request = validateRestoreRequest(
    {
      requestedBy: input.requestedBy,
      resourceId: input.resourceId,
      resourceType: input.resourceType,
      version: input.version,
    },
    definition,
  );
  const requestedTransition = parseCode(
    input.requestedTransition,
    "UNKNOWN_RECYCLE_BIN_TRANSITION",
  ) as RecycleBinTransition;
  if (
    !(definition.transitions as readonly string[]).includes(requestedTransition)
  ) {
    throw new RecycleBinError("UNKNOWN_RECYCLE_BIN_TRANSITION");
  }
  return Object.freeze({ ...request, requestedTransition });
}

export function validateRecycleBinPolicyResult(
  input: unknown,
): RecycleBinPolicyResult {
  if (!isPlainRecycleBinRecord(input)) {
    throw new RecycleBinError("INVALID_RECYCLE_BIN_POLICY_OUTPUT");
  }
  if (
    input.decision === "ALLOW" &&
    hasExactRecycleBinKeys(input, ["decision"])
  ) {
    return Object.freeze({ decision: "ALLOW" });
  }
  if (
    input.decision === "DENY" &&
    input.reason === "RECYCLE_BIN_POLICY_DENIED" &&
    hasExactRecycleBinKeys(input, ["decision", "reason"])
  ) {
    return Object.freeze({
      decision: "DENY",
      reason: "RECYCLE_BIN_POLICY_DENIED",
    });
  }
  throw new RecycleBinError("INVALID_RECYCLE_BIN_POLICY_OUTPUT");
}
