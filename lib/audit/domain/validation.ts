import {
  AUDIT_ACTOR_TYPES,
  AUDIT_EVENT_VERSION,
  AUDIT_RESULTS,
  type AuditChainHead,
  type AuditChainReference,
  type AuditEvent,
  type AuditEventVersion,
  type AuditWriteCommand,
} from "@/lib/audit/domain/audit-event";
import { AuditError, type AuditErrorCode } from "@/lib/audit/domain/error";
import {
  AUDIT_METADATA_KEYS,
  type AuditMetadata,
  type AuditMetadataKey,
  type AuditMetadataValue,
} from "@/lib/audit/domain/metadata";
import type {
  AuditHash,
  AuditIdentifier,
  AuditTimestamp,
} from "@/lib/audit/shared/references";

const AUDIT_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/;
const AUDIT_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,127}$/;
const AUDIT_VERSION_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const AUDIT_HASH_PATTERN = /^[a-f0-9]{64}$/;
const AUDIT_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const AUDIT_COMMAND_KEYS = [
  "action",
  "actingRole",
  "actorId",
  "actorType",
  "correlationId",
  "metadata",
  "organizationId",
  "platformScope",
  "policyVersion",
  "reason",
  "requestId",
  "resourceId",
  "resourceType",
  "result",
  "source",
] as const;

const AUDIT_EVENT_KEYS = [
  ...AUDIT_COMMAND_KEYS,
  "currentHash",
  "eventId",
  "occurredAt",
  "previousHash",
  "version",
] as const;

const AUDIT_CHAIN_HEAD_KEYS = [
  "chainId",
  "currentHash",
  "eventId",
  "occurredAt",
  "version",
] as const;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function parseIdentifier(
  value: unknown,
  errorCode: AuditErrorCode,
): AuditIdentifier {
  if (typeof value !== "string" || !AUDIT_IDENTIFIER_PATTERN.test(value)) {
    throw new AuditError(errorCode);
  }
  return value;
}

function parseCode(value: unknown, errorCode: AuditErrorCode): string {
  if (typeof value !== "string" || !AUDIT_CODE_PATTERN.test(value)) {
    throw new AuditError(errorCode);
  }
  return value;
}

function parseVersionReference(value: unknown): string {
  if (
    typeof value !== "string" ||
    !AUDIT_VERSION_REFERENCE_PATTERN.test(value)
  ) {
    throw new AuditError("INVALID_AUDIT_INPUT");
  }
  return value;
}

function parseMetadataValue(
  key: AuditMetadataKey,
  value: unknown,
): AuditMetadataValue {
  if (key === "impactCount") {
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      throw new AuditError("INVALID_AUDIT_METADATA");
    }
    return value;
  }
  if (
    typeof value !== "string" ||
    !AUDIT_VERSION_REFERENCE_PATTERN.test(value)
  ) {
    throw new AuditError("INVALID_AUDIT_METADATA");
  }
  return value;
}

export function validateAuditMetadata(value: unknown): AuditMetadata {
  if (!isRecord(value)) {
    throw new AuditError("INVALID_AUDIT_METADATA");
  }
  const keys = Object.keys(value);
  if (
    keys.length > AUDIT_METADATA_KEYS.length ||
    keys.some(
      (key) => !(AUDIT_METADATA_KEYS as readonly string[]).includes(key),
    )
  ) {
    throw new AuditError("INVALID_AUDIT_METADATA");
  }

  const metadata: Partial<Record<AuditMetadataKey, AuditMetadataValue>> = {};
  for (const key of keys) {
    const metadataKey = key as AuditMetadataKey;
    metadata[metadataKey] = parseMetadataValue(metadataKey, value[key]);
  }
  return Object.freeze(metadata);
}

function validateAuditCommandFields(
  input: Readonly<Record<string, unknown>>,
): AuditWriteCommand {
  const actorId = parseIdentifier(input.actorId, "INVALID_AUDIT_ACTOR");
  if (
    typeof input.actorType !== "string" ||
    !(AUDIT_ACTOR_TYPES as readonly string[]).includes(input.actorType)
  ) {
    throw new AuditError("INVALID_AUDIT_ACTOR");
  }

  const platformScope = input.platformScope;
  if (typeof platformScope !== "boolean") {
    throw new AuditError("INVALID_AUDIT_SCOPE");
  }
  const organizationId =
    input.organizationId === null
      ? null
      : parseIdentifier(input.organizationId, "INVALID_AUDIT_SCOPE");
  if (
    (platformScope && organizationId !== null) ||
    (!platformScope && organizationId === null)
  ) {
    throw new AuditError("INVALID_AUDIT_SCOPE");
  }

  const actingRole =
    input.actingRole === undefined
      ? undefined
      : parseCode(input.actingRole, "INVALID_AUDIT_ACTOR");
  const policyVersion =
    input.policyVersion === undefined
      ? undefined
      : parseVersionReference(input.policyVersion);

  return Object.freeze({
    action: parseCode(input.action, "INVALID_AUDIT_ACTION"),
    ...(actingRole === undefined ? {} : { actingRole }),
    actorId,
    actorType: input.actorType as AuditWriteCommand["actorType"],
    correlationId: parseIdentifier(input.correlationId, "INVALID_AUDIT_INPUT"),
    metadata: validateAuditMetadata(input.metadata),
    organizationId,
    platformScope,
    ...(policyVersion === undefined ? {} : { policyVersion }),
    reason: parseCode(input.reason, "INVALID_AUDIT_ACTION"),
    requestId: parseIdentifier(input.requestId, "INVALID_AUDIT_INPUT"),
    resourceId: parseIdentifier(input.resourceId, "INVALID_AUDIT_RESOURCE"),
    resourceType: parseCode(input.resourceType, "INVALID_AUDIT_RESOURCE"),
    result:
      typeof input.result === "string" &&
      (AUDIT_RESULTS as readonly string[]).includes(input.result)
        ? (input.result as AuditWriteCommand["result"])
        : (() => {
            throw new AuditError("INVALID_AUDIT_INPUT");
          })(),
    source: parseCode(input.source, "INVALID_AUDIT_INPUT"),
  });
}

export function validateAuditWriteCommand(input: unknown): AuditWriteCommand {
  if (!isRecord(input) || !hasOnlyKeys(input, AUDIT_COMMAND_KEYS)) {
    throw new AuditError("INVALID_AUDIT_INPUT");
  }
  return validateAuditCommandFields(input);
}

export function validateAuditTimestamp(value: unknown): AuditTimestamp {
  if (typeof value !== "string" || !AUDIT_TIMESTAMP_PATTERN.test(value)) {
    throw new AuditError("INVALID_AUDIT_TIMESTAMP");
  }
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime()) || timestamp.toISOString() !== value) {
    throw new AuditError("INVALID_AUDIT_TIMESTAMP");
  }
  return value;
}

export function validateAuditEventId(value: unknown): AuditIdentifier {
  return parseIdentifier(value, "INVALID_AUDIT_INPUT");
}

export function validateAuditHash(value: unknown): AuditHash {
  if (typeof value !== "string" || !AUDIT_HASH_PATTERN.test(value)) {
    throw new AuditError("INVALID_AUDIT_HASH");
  }
  return value as AuditHash;
}

function validateAuditVersion(value: unknown): AuditEventVersion {
  if (value !== AUDIT_EVENT_VERSION) {
    throw new AuditError("INVALID_AUDIT_VERSION");
  }
  return AUDIT_EVENT_VERSION;
}

export function createImmutableAuditEvent(input: unknown): AuditEvent {
  if (!isRecord(input) || !hasOnlyKeys(input, AUDIT_EVENT_KEYS)) {
    throw new AuditError("INVALID_AUDIT_INPUT");
  }
  const command = validateAuditCommandFields(input);
  const previousHash =
    input.previousHash === null ? null : validateAuditHash(input.previousHash);

  return Object.freeze({
    ...command,
    currentHash: validateAuditHash(input.currentHash),
    eventId: parseIdentifier(input.eventId, "INVALID_AUDIT_INPUT"),
    occurredAt: validateAuditTimestamp(input.occurredAt),
    previousHash,
    version: validateAuditVersion(input.version),
  });
}

export function createAuditChainReference(
  command: AuditWriteCommand,
): AuditChainReference {
  return Object.freeze({
    chainId:
      command.organizationId === null
        ? "platform"
        : `organization:${command.organizationId}`,
    organizationId: command.organizationId,
    platformScope: command.platformScope,
  });
}

export function validateAuditChainHead(
  value: unknown,
  expectedChain: AuditChainReference,
): AuditChainHead {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, AUDIT_CHAIN_HEAD_KEYS) ||
    value.chainId !== expectedChain.chainId
  ) {
    throw new AuditError("INVALID_AUDIT_CHAIN_HEAD");
  }
  return Object.freeze({
    chainId: parseIdentifier(value.chainId, "INVALID_AUDIT_CHAIN_HEAD"),
    currentHash: validateAuditHash(value.currentHash),
    eventId: parseIdentifier(value.eventId, "INVALID_AUDIT_CHAIN_HEAD"),
    occurredAt: validateAuditTimestamp(value.occurredAt),
    version: validateAuditVersion(value.version),
  });
}
