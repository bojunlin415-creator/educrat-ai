import {
  LIFECYCLE_DEFINITION_VERSION,
  type LifecycleDefinition,
  type LifecycleDefinitionVersion,
} from "@/lib/lifecycle/domain/definition";
import {
  LIFECYCLE_DECISION_REASONS,
  type LifecycleDecisionReason,
} from "@/lib/lifecycle/domain/decision";
import type { LifecycleEvaluationRequest } from "@/lib/lifecycle/domain/evaluation";
import {
  LifecycleError,
  type LifecycleErrorCode,
} from "@/lib/lifecycle/domain/error";
import type { LifecyclePolicyResult } from "@/lib/lifecycle/domain/policy";
import type { LifecycleRequirements } from "@/lib/lifecycle/domain/requirements";
import {
  LIFECYCLE_STATE_CATEGORIES,
  type LifecycleState,
  type LifecycleStateCategory,
} from "@/lib/lifecycle/domain/state";
import {
  LIFECYCLE_INTENTS,
  type LifecycleTransition,
} from "@/lib/lifecycle/domain/transition";
import type {
  LifecycleDefinitionId,
  LifecycleIntent,
  LifecycleStateId,
  LifecycleTransitionId,
} from "@/lib/lifecycle/shared/references";

const LIFECYCLE_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,127}$/;

const DEFINITION_KEYS = [
  "definitionId",
  "states",
  "transitions",
  "version",
] as const;
const STATE_KEYS = [
  "category",
  "id",
  "isRestorable",
  "isTerminal",
  "readonly",
  "version",
] as const;
const TRANSITION_KEYS = [
  "from",
  "intent",
  "requirements",
  "to",
  "transitionId",
  "version",
] as const;
const REQUIREMENT_KEYS = [
  "auditRequired",
  "authorizationRequired",
  "dependencyCheckRequired",
  "legalHoldRequired",
  "reauthenticationRequired",
  "retentionRequired",
] as const;
const EVALUATION_REQUEST_KEYS = [
  "currentStateId",
  "definitionId",
  "intent",
  "targetStateId",
  "transitionId",
  "version",
] as const;

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

function parseCode(value: unknown, errorCode: LifecycleErrorCode): string {
  if (typeof value !== "string" || !LIFECYCLE_CODE_PATTERN.test(value)) {
    throw new LifecycleError(errorCode);
  }
  return value;
}

function parseVersion(value: unknown): LifecycleDefinitionVersion {
  if (value !== LIFECYCLE_DEFINITION_VERSION) {
    throw new LifecycleError("UNSUPPORTED_LIFECYCLE_VERSION");
  }
  return LIFECYCLE_DEFINITION_VERSION;
}

function parseRequirements(value: unknown): LifecycleRequirements {
  if (!isPlainRecord(value) || !hasExactKeys(value, REQUIREMENT_KEYS)) {
    throw new LifecycleError("INVALID_LIFECYCLE_REQUIREMENTS");
  }
  for (const key of REQUIREMENT_KEYS) {
    if (typeof value[key] !== "boolean") {
      throw new LifecycleError("INVALID_LIFECYCLE_REQUIREMENTS");
    }
  }
  return Object.freeze({
    auditRequired: value.auditRequired as boolean,
    authorizationRequired: value.authorizationRequired as boolean,
    dependencyCheckRequired: value.dependencyCheckRequired as boolean,
    legalHoldRequired: value.legalHoldRequired as boolean,
    reauthenticationRequired: value.reauthenticationRequired as boolean,
    retentionRequired: value.retentionRequired as boolean,
  });
}

function parseState(value: unknown): LifecycleState {
  if (!isPlainRecord(value) || !hasExactKeys(value, STATE_KEYS)) {
    throw new LifecycleError("INVALID_LIFECYCLE_INPUT");
  }
  if (
    typeof value.category !== "string" ||
    !(LIFECYCLE_STATE_CATEGORIES as readonly string[]).includes(value.category)
  ) {
    throw new LifecycleError("INVALID_LIFECYCLE_INPUT");
  }
  for (const key of ["isRestorable", "isTerminal", "readonly"] as const) {
    if (typeof value[key] !== "boolean") {
      throw new LifecycleError("INVALID_LIFECYCLE_INPUT");
    }
  }
  if (value.isTerminal === true && value.readonly !== true) {
    throw new LifecycleError("INVALID_LIFECYCLE_INPUT");
  }

  return Object.freeze({
    category: value.category as LifecycleStateCategory,
    id: parseCode(value.id, "UNKNOWN_LIFECYCLE_STATE") as LifecycleStateId,
    isRestorable: value.isRestorable as boolean,
    isTerminal: value.isTerminal as boolean,
    readonly: value.readonly as boolean,
    version: parseVersion(value.version),
  });
}

function parseTransition(value: unknown): LifecycleTransition {
  if (!isPlainRecord(value) || !hasExactKeys(value, TRANSITION_KEYS)) {
    throw new LifecycleError("INVALID_LIFECYCLE_INPUT");
  }
  const intent = parseCode(
    value.intent,
    "UNKNOWN_LIFECYCLE_INTENT",
  ) as LifecycleIntent;
  if (!(LIFECYCLE_INTENTS as readonly string[]).includes(intent)) {
    throw new LifecycleError("UNKNOWN_LIFECYCLE_INTENT");
  }

  return Object.freeze({
    from: parseCode(value.from, "UNKNOWN_LIFECYCLE_STATE") as LifecycleStateId,
    intent,
    requirements: parseRequirements(value.requirements),
    to: parseCode(value.to, "UNKNOWN_LIFECYCLE_STATE") as LifecycleStateId,
    transitionId: parseCode(
      value.transitionId,
      "UNKNOWN_LIFECYCLE_TRANSITION",
    ) as LifecycleTransitionId,
    version: parseVersion(value.version),
  });
}

export function validateLifecycleDefinition(
  input: unknown,
): LifecycleDefinition {
  if (!isPlainRecord(input) || !hasExactKeys(input, DEFINITION_KEYS)) {
    throw new LifecycleError("INVALID_LIFECYCLE_INPUT");
  }
  if (!Array.isArray(input.states) || input.states.length === 0) {
    throw new LifecycleError("UNKNOWN_LIFECYCLE_STATE");
  }
  if (!Array.isArray(input.transitions) || input.transitions.length === 0) {
    throw new LifecycleError("UNKNOWN_LIFECYCLE_TRANSITION");
  }

  const version = parseVersion(input.version);
  const states = Object.freeze(input.states.map(parseState));
  const stateIds = new Set<string>();
  for (const state of states) {
    if (state.version !== version) {
      throw new LifecycleError("UNSUPPORTED_LIFECYCLE_VERSION");
    }
    if (stateIds.has(state.id)) {
      throw new LifecycleError("DUPLICATE_LIFECYCLE_STATE");
    }
    stateIds.add(state.id);
  }

  const transitions = Object.freeze(input.transitions.map(parseTransition));
  const transitionIds = new Set<string>();
  const transitionRoutes = new Set<string>();
  for (const transition of transitions) {
    if (transition.version !== version) {
      throw new LifecycleError("UNSUPPORTED_LIFECYCLE_VERSION");
    }
    if (transitionIds.has(transition.transitionId)) {
      throw new LifecycleError("DUPLICATE_LIFECYCLE_TRANSITION");
    }
    transitionIds.add(transition.transitionId);

    if (!stateIds.has(transition.from) || !stateIds.has(transition.to)) {
      throw new LifecycleError("UNKNOWN_LIFECYCLE_STATE");
    }
    const route = `${transition.from}:${transition.to}:${transition.intent}`;
    if (transitionRoutes.has(route)) {
      throw new LifecycleError("DUPLICATE_LIFECYCLE_TRANSITION");
    }
    transitionRoutes.add(route);

    const fromState = states.find((state) => state.id === transition.from);
    if (fromState?.isTerminal) {
      throw new LifecycleError("TERMINAL_STATE_HAS_OUTGOING_TRANSITION");
    }
  }

  return Object.freeze({
    definitionId: parseCode(
      input.definitionId,
      "UNKNOWN_LIFECYCLE_DEFINITION",
    ) as LifecycleDefinitionId,
    states,
    transitions,
    version,
  });
}

export function validateLifecyclePolicyResult(
  input: unknown,
): LifecyclePolicyResult {
  if (!isPlainRecord(input) || typeof input.decision !== "string") {
    throw new LifecycleError("INVALID_LIFECYCLE_POLICY_RESULT");
  }
  if (input.decision === "ALLOW" && hasExactKeys(input, ["decision"])) {
    return Object.freeze({ decision: "ALLOW" });
  }
  if (
    input.decision === "DENY" &&
    hasExactKeys(input, ["decision", "reason"]) &&
    typeof input.reason === "string" &&
    (LIFECYCLE_DECISION_REASONS as readonly string[]).includes(input.reason) &&
    input.reason !== "TRANSITION_ALLOWED"
  ) {
    return Object.freeze({
      decision: "DENY",
      reason: input.reason as LifecycleDecisionReason,
    });
  }
  throw new LifecycleError("INVALID_LIFECYCLE_POLICY_RESULT");
}

export function validateLifecycleEvaluationRequest(
  input: unknown,
): LifecycleEvaluationRequest {
  if (!isPlainRecord(input) || !hasExactKeys(input, EVALUATION_REQUEST_KEYS)) {
    throw new LifecycleError("INVALID_LIFECYCLE_INPUT");
  }
  const intent = parseCode(
    input.intent,
    "UNKNOWN_LIFECYCLE_INTENT",
  ) as LifecycleIntent;
  if (!isLifecycleIntent(intent)) {
    throw new LifecycleError("UNKNOWN_LIFECYCLE_INTENT");
  }

  return Object.freeze({
    currentStateId: parseCode(
      input.currentStateId,
      "UNKNOWN_LIFECYCLE_STATE",
    ) as LifecycleStateId,
    definitionId: parseCode(
      input.definitionId,
      "UNKNOWN_LIFECYCLE_DEFINITION",
    ) as LifecycleDefinitionId,
    intent,
    targetStateId: parseCode(
      input.targetStateId,
      "UNKNOWN_LIFECYCLE_STATE",
    ) as LifecycleStateId,
    transitionId: parseCode(
      input.transitionId,
      "UNKNOWN_LIFECYCLE_TRANSITION",
    ) as LifecycleTransitionId,
    version: parseVersion(input.version),
  });
}

export function isLifecycleIntent(value: unknown): value is LifecycleIntent {
  return (
    typeof value === "string" &&
    (LIFECYCLE_INTENTS as readonly string[]).includes(value)
  );
}

export function parseLifecycleLookupCode(
  value: unknown,
  errorCode: LifecycleErrorCode,
): string {
  return parseCode(value, errorCode);
}

export function validateLifecycleLookupVersion(
  value: unknown,
): LifecycleDefinitionVersion {
  return parseVersion(value);
}
