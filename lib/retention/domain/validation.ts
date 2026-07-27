import {
  RETENTION_CONTRACT_VERSION,
  RETENTION_PERIOD_UNITS,
  type RetentionContractVersion,
  type RetentionDefinition,
  type RetentionMetadataEntry,
  type RetentionMetadataValue,
  type RetentionPeriod,
  type RetentionPeriodUnit,
  type RetentionRegistryDefinition,
} from "@/lib/retention/domain/definition";
import {
  RetentionError,
  type RetentionErrorCode,
} from "@/lib/retention/domain/error";
import type { LegalHoldReference } from "@/lib/retention/domain/legal-hold";
import type { RetentionPolicyResult } from "@/lib/retention/domain/policy";
import type { RetentionCheckRequest } from "@/lib/retention/domain/request";
import type {
  LegalHoldId,
  LegalHoldReason,
  RetentionCategory,
  RetentionMetadataCode,
  RetentionResourceId,
  RetentionResourceType,
  RetentionTransition,
} from "@/lib/retention/shared/references";

const RETENTION_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,127}$/;
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_RETENTION_DEFINITIONS = 1_000;
const MAX_RETENTION_METADATA_ENTRIES = 16;
const MAX_LEGAL_HOLDS = 1_000;
const MAX_RETENTION_PERIOD_AMOUNT = 1_000_000;
const MAX_METADATA_NUMBER = 1_000_000_000;

const REGISTRY_KEYS = [
  "definitions",
  "retentionCategories",
  "transitions",
  "version",
] as const;
const DEFINITION_KEYS = [
  "legalHoldSupported",
  "metadata",
  "minimumRetentionPeriod",
  "resourceType",
  "retentionCategory",
  "version",
] as const;
const PERIOD_KEYS = ["amount", "unit"] as const;
const METADATA_ENTRY_KEYS = ["key", "value"] as const;
const REQUEST_KEYS = [
  "requestedTransition",
  "resourceId",
  "resourceType",
  "version",
] as const;
const LEGAL_HOLD_KEYS = [
  "active",
  "holdId",
  "holdReason",
  "resourceId",
  "resourceType",
  "version",
] as const;
const EVALUATION_INPUT_KEYS = ["legalHolds", "request"] as const;

export interface ValidatedRetentionEvaluationInput {
  readonly definition: RetentionDefinition;
  readonly legalHolds: readonly LegalHoldReference[];
  readonly request: RetentionCheckRequest;
}

export function isPlainRetentionRecord(
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

export function hasExactRetentionKeys(
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

function parseCode(value: unknown, errorCode: RetentionErrorCode): string {
  if (typeof value !== "string" || !RETENTION_CODE_PATTERN.test(value)) {
    throw new RetentionError(errorCode);
  }
  return value;
}

function parseResourceId(
  value: unknown,
  errorCode: RetentionErrorCode = "INVALID_RETENTION_INPUT",
): RetentionResourceId {
  if (typeof value !== "string" || !RESOURCE_ID_PATTERN.test(value)) {
    throw new RetentionError(errorCode);
  }
  return value as RetentionResourceId;
}

function parseLegalHoldId(value: unknown): LegalHoldId {
  if (typeof value !== "string" || !RESOURCE_ID_PATTERN.test(value)) {
    throw new RetentionError("INVALID_LEGAL_HOLD");
  }
  return value as LegalHoldId;
}

function parseVersion(value: unknown): RetentionContractVersion {
  if (value !== RETENTION_CONTRACT_VERSION) {
    throw new RetentionError("UNSUPPORTED_RETENTION_VERSION");
  }
  return RETENTION_CONTRACT_VERSION;
}

function parseUniqueCodes<T extends string>(
  value: unknown,
  unknownCode: RetentionErrorCode,
  duplicateCode: RetentionErrorCode,
): readonly T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new RetentionError(unknownCode);
  }
  const parsed = value.map((entry) => parseCode(entry, unknownCode) as T);
  if (new Set(parsed).size !== parsed.length) {
    throw new RetentionError(duplicateCode);
  }
  return Object.freeze([...parsed].sort());
}

function parseRetentionPeriod(input: unknown): RetentionPeriod {
  if (
    !isPlainRetentionRecord(input) ||
    !hasExactRetentionKeys(input, PERIOD_KEYS)
  ) {
    throw new RetentionError("INVALID_RETENTION_RULE");
  }
  if (
    typeof input.amount !== "number" ||
    !Number.isSafeInteger(input.amount) ||
    input.amount < 0 ||
    input.amount > MAX_RETENTION_PERIOD_AMOUNT ||
    typeof input.unit !== "string" ||
    !(RETENTION_PERIOD_UNITS as readonly string[]).includes(input.unit)
  ) {
    throw new RetentionError("INVALID_RETENTION_RULE");
  }
  return Object.freeze({
    amount: input.amount,
    unit: input.unit as RetentionPeriodUnit,
  });
}

function parseMetadataValue(value: unknown): RetentionMetadataValue {
  if (typeof value === "boolean") return value;
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_METADATA_NUMBER
  ) {
    return value;
  }
  return parseCode(value, "INVALID_RETENTION_RULE") as RetentionMetadataCode;
}

function parseRetentionMetadata(
  input: unknown,
): readonly RetentionMetadataEntry[] {
  if (!Array.isArray(input) || input.length > MAX_RETENTION_METADATA_ENTRIES) {
    throw new RetentionError("INVALID_RETENTION_RULE");
  }
  const metadata = input.map((entry) => {
    if (
      !isPlainRetentionRecord(entry) ||
      !hasExactRetentionKeys(entry, METADATA_ENTRY_KEYS)
    ) {
      throw new RetentionError("INVALID_RETENTION_RULE");
    }
    return Object.freeze({
      key: parseCode(
        entry.key,
        "INVALID_RETENTION_RULE",
      ) as RetentionMetadataCode,
      value: parseMetadataValue(entry.value),
    });
  });
  const keys = metadata.map((entry) => entry.key);
  if (new Set(keys).size !== keys.length) {
    throw new RetentionError("INVALID_RETENTION_RULE");
  }
  return Object.freeze(
    [...metadata].sort((left, right) => left.key.localeCompare(right.key)),
  );
}

export function validateRetentionDefinition(
  input: unknown,
  retentionCategories: readonly RetentionCategory[],
): RetentionDefinition {
  if (
    !isPlainRetentionRecord(input) ||
    !hasExactRetentionKeys(input, DEFINITION_KEYS)
  ) {
    throw new RetentionError("INVALID_RETENTION_RULE");
  }
  const version = parseVersion(input.version);
  const resourceType = parseCode(
    input.resourceType,
    "UNKNOWN_RETENTION_RESOURCE",
  ) as RetentionResourceType;
  const retentionCategory = parseCode(
    input.retentionCategory,
    "UNKNOWN_RETENTION_CATEGORY",
  ) as RetentionCategory;
  if (!(retentionCategories as readonly string[]).includes(retentionCategory)) {
    throw new RetentionError("UNKNOWN_RETENTION_CATEGORY");
  }
  if (typeof input.legalHoldSupported !== "boolean") {
    throw new RetentionError("INVALID_RETENTION_RULE");
  }

  return Object.freeze({
    legalHoldSupported: input.legalHoldSupported,
    metadata: parseRetentionMetadata(input.metadata),
    minimumRetentionPeriod: parseRetentionPeriod(input.minimumRetentionPeriod),
    resourceType,
    retentionCategory,
    version,
  });
}

export function validateRetentionRegistryDefinition(
  input: unknown,
): RetentionRegistryDefinition {
  if (
    !isPlainRetentionRecord(input) ||
    !hasExactRetentionKeys(input, REGISTRY_KEYS)
  ) {
    throw new RetentionError("INVALID_RETENTION_INPUT");
  }
  const version = parseVersion(input.version);
  const retentionCategories = parseUniqueCodes<RetentionCategory>(
    input.retentionCategories,
    "UNKNOWN_RETENTION_CATEGORY",
    "DUPLICATE_RETENTION_CATEGORY",
  );
  const transitions = parseUniqueCodes<RetentionTransition>(
    input.transitions,
    "UNKNOWN_RETENTION_TRANSITION",
    "DUPLICATE_RETENTION_TRANSITION",
  );
  if (
    !Array.isArray(input.definitions) ||
    input.definitions.length === 0 ||
    input.definitions.length > MAX_RETENTION_DEFINITIONS
  ) {
    throw new RetentionError("INVALID_RETENTION_RULE");
  }
  const definitions = input.definitions.map((definition) =>
    validateRetentionDefinition(definition, retentionCategories),
  );
  const resourceTypes = definitions.map(
    (definition) => definition.resourceType,
  );
  if (new Set(resourceTypes).size !== resourceTypes.length) {
    throw new RetentionError("DUPLICATE_RETENTION_RESOURCE");
  }

  return Object.freeze({
    definitions: Object.freeze(
      [...definitions].sort((left, right) =>
        left.resourceType.localeCompare(right.resourceType),
      ),
    ),
    retentionCategories,
    transitions,
    version,
  });
}

export function validateRetentionCheckRequest(
  input: unknown,
  registry: RetentionRegistryDefinition,
): RetentionCheckRequest {
  if (
    !isPlainRetentionRecord(input) ||
    !hasExactRetentionKeys(input, REQUEST_KEYS)
  ) {
    throw new RetentionError("INVALID_RETENTION_INPUT");
  }
  const version = parseVersion(input.version);
  if (version !== registry.version) {
    throw new RetentionError("UNSUPPORTED_RETENTION_VERSION");
  }
  const resourceType = parseCode(
    input.resourceType,
    "UNKNOWN_RETENTION_RESOURCE",
  ) as RetentionResourceType;
  if (
    !registry.definitions.some(
      (definition) => definition.resourceType === resourceType,
    )
  ) {
    throw new RetentionError("UNKNOWN_RETENTION_RESOURCE");
  }
  const requestedTransition = parseCode(
    input.requestedTransition,
    "UNKNOWN_RETENTION_TRANSITION",
  ) as RetentionTransition;
  if (
    !(registry.transitions as readonly string[]).includes(requestedTransition)
  ) {
    throw new RetentionError("UNKNOWN_RETENTION_TRANSITION");
  }

  return Object.freeze({
    requestedTransition,
    resourceId: parseResourceId(input.resourceId),
    resourceType,
    version,
  });
}

function parseLegalHoldReference(
  input: unknown,
  request: RetentionCheckRequest,
): LegalHoldReference {
  if (
    !isPlainRetentionRecord(input) ||
    !hasExactRetentionKeys(input, LEGAL_HOLD_KEYS)
  ) {
    throw new RetentionError("INVALID_LEGAL_HOLD");
  }
  const version = parseVersion(input.version);
  const resourceType = parseCode(
    input.resourceType,
    "INVALID_LEGAL_HOLD",
  ) as RetentionResourceType;
  const resourceId = parseResourceId(input.resourceId, "INVALID_LEGAL_HOLD");
  if (
    resourceType !== request.resourceType ||
    resourceId !== request.resourceId ||
    typeof input.active !== "boolean"
  ) {
    throw new RetentionError("INVALID_LEGAL_HOLD");
  }

  return Object.freeze({
    active: input.active,
    holdId: parseLegalHoldId(input.holdId),
    holdReason: parseCode(
      input.holdReason,
      "INVALID_LEGAL_HOLD",
    ) as LegalHoldReason,
    resourceId,
    resourceType,
    version,
  });
}

export function validateLegalHoldReferences(
  input: unknown,
  request: RetentionCheckRequest,
  definition: RetentionDefinition,
): readonly LegalHoldReference[] {
  if (!Array.isArray(input) || input.length > MAX_LEGAL_HOLDS) {
    throw new RetentionError("INVALID_LEGAL_HOLD");
  }
  if (!definition.legalHoldSupported && input.length > 0) {
    throw new RetentionError("INVALID_LEGAL_HOLD");
  }
  const legalHolds = input.map((entry) =>
    parseLegalHoldReference(entry, request),
  );
  const holdIds = legalHolds.map((hold) => hold.holdId);
  if (new Set(holdIds).size !== holdIds.length) {
    throw new RetentionError("DUPLICATE_LEGAL_HOLD");
  }
  return Object.freeze(
    [...legalHolds].sort((left, right) =>
      left.holdId.localeCompare(right.holdId),
    ),
  );
}

export function validateRetentionEvaluationInput(
  input: unknown,
  registry: RetentionRegistryDefinition,
): ValidatedRetentionEvaluationInput {
  if (
    !isPlainRetentionRecord(input) ||
    !hasExactRetentionKeys(input, EVALUATION_INPUT_KEYS)
  ) {
    throw new RetentionError("INVALID_RETENTION_INPUT");
  }
  const request = validateRetentionCheckRequest(input.request, registry);
  const definition = registry.definitions.find(
    (candidate) => candidate.resourceType === request.resourceType,
  );
  if (!definition) {
    throw new RetentionError("UNKNOWN_RETENTION_RESOURCE");
  }
  const legalHolds = validateLegalHoldReferences(
    input.legalHolds,
    request,
    definition,
  );
  return Object.freeze({ definition, legalHolds, request });
}

export function validateRetentionPolicyResult(
  input: unknown,
): RetentionPolicyResult {
  if (!isPlainRetentionRecord(input) || typeof input.decision !== "string") {
    throw new RetentionError("INVALID_RETENTION_POLICY_RESULT");
  }
  if (
    input.decision === "ALLOW" &&
    hasExactRetentionKeys(input, ["decision"])
  ) {
    return Object.freeze({ decision: "ALLOW" });
  }
  if (
    input.decision === "DENY" &&
    hasExactRetentionKeys(input, ["decision", "reason"]) &&
    input.reason === "RETENTION_POLICY_DENIED"
  ) {
    return Object.freeze({
      decision: "DENY",
      reason: "RETENTION_POLICY_DENIED",
    });
  }
  throw new RetentionError("INVALID_RETENTION_POLICY_RESULT");
}
