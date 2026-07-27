import type { ReAuthenticationChallenge } from "@/lib/re-authentication/domain/challenge";
import {
  REAUTHENTICATION_CONTRACT_VERSION,
  REAUTHENTICATION_RISK_LEVELS,
  type ReAuthenticationContractVersion,
  type ReAuthenticationMetadataEntry,
  type ReAuthenticationMetadataValue,
  type ReAuthenticationRegistryDefinition,
  type ReAuthenticationRequirement,
  type ReAuthenticationRiskLevel,
} from "@/lib/re-authentication/domain/definition";
import {
  ReAuthenticationError,
  type ReAuthenticationErrorCode,
} from "@/lib/re-authentication/domain/error";
import type { ReAuthenticationPolicyResult } from "@/lib/re-authentication/domain/policy";
import type { ReAuthenticationCheckRequest } from "@/lib/re-authentication/domain/request";
import type { ValidatedReAuthenticationEvaluationInput } from "@/lib/re-authentication/domain/evaluation-input";
import type {
  ReAuthenticationActionType,
  ReAuthenticationChallengeId,
  ReAuthenticationMetadataCode,
  ReAuthenticationChallengeType,
} from "@/lib/re-authentication/shared/references";

const REAUTHENTICATION_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,127}$/;
const CHALLENGE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ISO_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const MAX_REAUTHENTICATION_REQUIREMENTS = 1_000;
const MAX_REAUTHENTICATION_METADATA_ENTRIES = 16;
const MAX_METADATA_NUMBER = 1_000_000_000;

const REGISTRY_KEYS = [
  "actionTypes",
  "challengeTypes",
  "requirements",
  "version",
] as const;
const REQUIREMENT_KEYS = [
  "actionType",
  "challengeType",
  "metadata",
  "required",
  "riskLevel",
  "version",
] as const;
const METADATA_ENTRY_KEYS = ["key", "value"] as const;
const CHALLENGE_KEYS = [
  "challengeId",
  "challengeType",
  "expiresAt",
  "issuedAt",
  "version",
] as const;
const REQUEST_KEYS = ["actionType", "challenge", "version"] as const;

export function isPlainReAuthenticationRecord(
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

export function hasExactReAuthenticationKeys(
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

function parseCode(
  value: unknown,
  errorCode: ReAuthenticationErrorCode,
): string {
  if (typeof value !== "string" || !REAUTHENTICATION_CODE_PATTERN.test(value)) {
    throw new ReAuthenticationError(errorCode);
  }
  return value;
}

function parseChallengeId(value: unknown): ReAuthenticationChallengeId {
  if (typeof value !== "string" || !CHALLENGE_ID_PATTERN.test(value)) {
    throw new ReAuthenticationError("INVALID_REAUTHENTICATION_CHALLENGE");
  }
  return value as ReAuthenticationChallengeId;
}

function parseVersion(value: unknown): ReAuthenticationContractVersion {
  if (value !== REAUTHENTICATION_CONTRACT_VERSION) {
    throw new ReAuthenticationError("UNSUPPORTED_REAUTHENTICATION_VERSION");
  }
  return REAUTHENTICATION_CONTRACT_VERSION;
}

function parseUniqueCodes<T extends string>(
  value: unknown,
  unknownCode: ReAuthenticationErrorCode,
  duplicateCode: ReAuthenticationErrorCode,
): readonly T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ReAuthenticationError(unknownCode);
  }
  const parsed = value.map((entry) => parseCode(entry, unknownCode) as T);
  if (new Set(parsed).size !== parsed.length) {
    throw new ReAuthenticationError(duplicateCode);
  }
  return Object.freeze([...parsed].sort());
}

function parseMetadataValue(value: unknown): ReAuthenticationMetadataValue {
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
    "INVALID_REAUTHENTICATION_REQUIREMENT",
  ) as ReAuthenticationMetadataCode;
}

function parseReAuthenticationMetadata(
  input: unknown,
): readonly ReAuthenticationMetadataEntry[] {
  if (
    !Array.isArray(input) ||
    input.length > MAX_REAUTHENTICATION_METADATA_ENTRIES
  ) {
    throw new ReAuthenticationError("INVALID_REAUTHENTICATION_REQUIREMENT");
  }
  const metadata = input.map((entry) => {
    if (
      !isPlainReAuthenticationRecord(entry) ||
      !hasExactReAuthenticationKeys(entry, METADATA_ENTRY_KEYS)
    ) {
      throw new ReAuthenticationError("INVALID_REAUTHENTICATION_REQUIREMENT");
    }
    return Object.freeze({
      key: parseCode(
        entry.key,
        "INVALID_REAUTHENTICATION_REQUIREMENT",
      ) as ReAuthenticationMetadataCode,
      value: parseMetadataValue(entry.value),
    });
  });
  const keys = metadata.map((entry) => entry.key);
  if (new Set(keys).size !== keys.length) {
    throw new ReAuthenticationError("INVALID_REAUTHENTICATION_REQUIREMENT");
  }
  return Object.freeze(
    [...metadata].sort((left, right) => left.key.localeCompare(right.key)),
  );
}

export function validateReAuthenticationRequirement(
  input: unknown,
  actionTypes: readonly ReAuthenticationActionType[],
  challengeTypes: readonly ReAuthenticationChallengeType[],
): ReAuthenticationRequirement {
  if (
    !isPlainReAuthenticationRecord(input) ||
    !hasExactReAuthenticationKeys(input, REQUIREMENT_KEYS)
  ) {
    throw new ReAuthenticationError("INVALID_REAUTHENTICATION_REQUIREMENT");
  }
  const version = parseVersion(input.version);
  const actionType = parseCode(
    input.actionType,
    "UNKNOWN_REAUTHENTICATION_ACTION",
  ) as ReAuthenticationActionType;
  const challengeType = parseCode(
    input.challengeType,
    "UNKNOWN_REAUTHENTICATION_CHALLENGE_TYPE",
  ) as ReAuthenticationChallengeType;
  if (!(actionTypes as readonly string[]).includes(actionType)) {
    throw new ReAuthenticationError("UNKNOWN_REAUTHENTICATION_ACTION");
  }
  if (!(challengeTypes as readonly string[]).includes(challengeType)) {
    throw new ReAuthenticationError("UNKNOWN_REAUTHENTICATION_CHALLENGE_TYPE");
  }
  if (
    typeof input.riskLevel !== "string" ||
    !(REAUTHENTICATION_RISK_LEVELS as readonly string[]).includes(
      input.riskLevel,
    ) ||
    typeof input.required !== "boolean"
  ) {
    throw new ReAuthenticationError("INVALID_REAUTHENTICATION_REQUIREMENT");
  }

  return Object.freeze({
    actionType,
    challengeType,
    metadata: parseReAuthenticationMetadata(input.metadata),
    required: input.required,
    riskLevel: input.riskLevel as ReAuthenticationRiskLevel,
    version,
  });
}

export function validateReAuthenticationRegistryDefinition(
  input: unknown,
): ReAuthenticationRegistryDefinition {
  if (
    !isPlainReAuthenticationRecord(input) ||
    !hasExactReAuthenticationKeys(input, REGISTRY_KEYS)
  ) {
    throw new ReAuthenticationError("INVALID_REAUTHENTICATION_INPUT");
  }
  const version = parseVersion(input.version);
  const actionTypes = parseUniqueCodes<ReAuthenticationActionType>(
    input.actionTypes,
    "UNKNOWN_REAUTHENTICATION_ACTION",
    "DUPLICATE_REAUTHENTICATION_ACTION",
  );
  const challengeTypes = parseUniqueCodes<ReAuthenticationChallengeType>(
    input.challengeTypes,
    "UNKNOWN_REAUTHENTICATION_CHALLENGE_TYPE",
    "DUPLICATE_REAUTHENTICATION_CHALLENGE_TYPE",
  );
  if (
    !Array.isArray(input.requirements) ||
    input.requirements.length === 0 ||
    input.requirements.length > MAX_REAUTHENTICATION_REQUIREMENTS
  ) {
    throw new ReAuthenticationError("INVALID_REAUTHENTICATION_REQUIREMENT");
  }
  const requirements = input.requirements.map((requirement) =>
    validateReAuthenticationRequirement(
      requirement,
      actionTypes,
      challengeTypes,
    ),
  );
  const requirementKeys = requirements.map(
    (requirement) => requirement.actionType,
  );
  if (new Set(requirementKeys).size !== requirementKeys.length) {
    throw new ReAuthenticationError("DUPLICATE_REAUTHENTICATION_REQUIREMENT");
  }

  return Object.freeze({
    actionTypes,
    challengeTypes,
    requirements: Object.freeze(
      [...requirements].sort((left, right) =>
        left.actionType.localeCompare(right.actionType),
      ),
    ),
    version,
  });
}

function parseIsoInstant(value: unknown): string {
  if (typeof value !== "string" || !ISO_INSTANT_PATTERN.test(value)) {
    throw new ReAuthenticationError("INVALID_REAUTHENTICATION_CHALLENGE");
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new ReAuthenticationError("INVALID_REAUTHENTICATION_CHALLENGE");
  }
  return value;
}

export function validateReAuthenticationChallenge(
  input: unknown,
  challengeTypes: readonly ReAuthenticationChallengeType[],
): ReAuthenticationChallenge {
  if (
    !isPlainReAuthenticationRecord(input) ||
    !hasExactReAuthenticationKeys(input, CHALLENGE_KEYS)
  ) {
    throw new ReAuthenticationError("INVALID_REAUTHENTICATION_CHALLENGE");
  }
  const version = parseVersion(input.version);
  const challengeType = parseCode(
    input.challengeType,
    "UNKNOWN_REAUTHENTICATION_CHALLENGE_TYPE",
  ) as ReAuthenticationChallengeType;
  if (!(challengeTypes as readonly string[]).includes(challengeType)) {
    throw new ReAuthenticationError("UNKNOWN_REAUTHENTICATION_CHALLENGE_TYPE");
  }
  const issuedAt = parseIsoInstant(input.issuedAt);
  const expiresAt = parseIsoInstant(input.expiresAt);
  if (Date.parse(expiresAt) <= Date.parse(issuedAt)) {
    throw new ReAuthenticationError("INVALID_REAUTHENTICATION_CHALLENGE");
  }

  return Object.freeze({
    challengeId: parseChallengeId(input.challengeId),
    challengeType,
    expiresAt,
    issuedAt,
    version,
  });
}

export function validateReAuthenticationCheckRequest(
  input: unknown,
  definition: ReAuthenticationRegistryDefinition,
): ReAuthenticationCheckRequest {
  if (
    !isPlainReAuthenticationRecord(input) ||
    !hasExactReAuthenticationKeys(
      input,
      input.challenge === undefined ? ["actionType", "version"] : REQUEST_KEYS,
    )
  ) {
    throw new ReAuthenticationError("INVALID_REAUTHENTICATION_INPUT");
  }
  const version = parseVersion(input.version);
  const actionType = parseCode(
    input.actionType,
    "UNKNOWN_REAUTHENTICATION_ACTION",
  ) as ReAuthenticationActionType;
  if (!(definition.actionTypes as readonly string[]).includes(actionType)) {
    throw new ReAuthenticationError("UNKNOWN_REAUTHENTICATION_ACTION");
  }
  const challenge =
    input.challenge === undefined
      ? undefined
      : validateReAuthenticationChallenge(
          input.challenge,
          definition.challengeTypes,
        );

  return Object.freeze({
    actionType,
    ...(challenge === undefined ? {} : { challenge }),
    version,
  });
}

export function validateReAuthenticationEvaluationInput(
  input: unknown,
  definition: ReAuthenticationRegistryDefinition,
): ValidatedReAuthenticationEvaluationInput {
  const request = validateReAuthenticationCheckRequest(input, definition);
  const requirement = definition.requirements.find(
    (entry) => entry.actionType === request.actionType,
  );
  if (requirement === undefined) {
    throw new ReAuthenticationError("UNKNOWN_REAUTHENTICATION_ACTION");
  }
  if (
    request.challenge !== undefined &&
    request.challenge.challengeType !== requirement.challengeType
  ) {
    throw new ReAuthenticationError("INVALID_REAUTHENTICATION_CHALLENGE");
  }
  return Object.freeze({
    ...(request.challenge === undefined
      ? {}
      : { challenge: request.challenge }),
    requirement,
    request,
  });
}

export function validateReAuthenticationPolicyResult(
  input: unknown,
): ReAuthenticationPolicyResult {
  if (!isPlainReAuthenticationRecord(input)) {
    throw new ReAuthenticationError("INVALID_REAUTHENTICATION_POLICY_RESULT");
  }
  if (
    input.decision === "ALLOW" &&
    hasExactReAuthenticationKeys(input, ["decision"])
  ) {
    return Object.freeze({ decision: "ALLOW" });
  }
  if (
    input.decision === "DENY" &&
    input.reason === "REAUTHENTICATION_POLICY_DENIED" &&
    hasExactReAuthenticationKeys(input, ["decision", "reason"])
  ) {
    return Object.freeze({
      decision: "DENY",
      reason: "REAUTHENTICATION_POLICY_DENIED",
    });
  }
  throw new ReAuthenticationError("INVALID_REAUTHENTICATION_POLICY_RESULT");
}
