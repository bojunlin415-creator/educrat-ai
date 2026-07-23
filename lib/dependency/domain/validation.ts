import {
  DEPENDENCY_CONTRACT_VERSION,
  type DependencyContractVersion,
  type DependencyDefinition,
} from "@/lib/dependency/domain/definition";
import {
  DependencyError,
  type DependencyErrorCode,
} from "@/lib/dependency/domain/error";
import {
  DEPENDENCY_DIRECTIONS,
  type DependencyDirection,
  type DependencyReference,
} from "@/lib/dependency/domain/model";
import type { DependencyPolicyResult } from "@/lib/dependency/domain/policy";
import type { DependencyCheckRequest } from "@/lib/dependency/domain/request";
import type {
  DependencyResourceId,
  DependencyResourceType,
  DependencyTransition,
  DependencyType,
} from "@/lib/dependency/shared/references";

const DEPENDENCY_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,127}$/;
const RESOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_DEPENDENCY_REFERENCES = 10_000;

const DEFINITION_KEYS = [
  "dependencyTypes",
  "resourceTypes",
  "transitions",
  "version",
] as const;
const REQUEST_KEYS = [
  "requestedTransition",
  "resourceId",
  "resourceType",
  "version",
] as const;
const REFERENCE_KEYS = [
  "dependencyType",
  "direction",
  "readonly",
  "relatedResourceId",
  "relatedResourceType",
  "resourceId",
  "resourceType",
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

function parseCode(value: unknown, errorCode: DependencyErrorCode): string {
  if (typeof value !== "string" || !DEPENDENCY_CODE_PATTERN.test(value)) {
    throw new DependencyError(errorCode);
  }
  return value;
}

function parseResourceId(value: unknown): DependencyResourceId {
  if (typeof value !== "string" || !RESOURCE_ID_PATTERN.test(value)) {
    throw new DependencyError("INVALID_DEPENDENCY_INPUT");
  }
  return value as DependencyResourceId;
}

function parseVersion(value: unknown): DependencyContractVersion {
  if (value !== DEPENDENCY_CONTRACT_VERSION) {
    throw new DependencyError("UNSUPPORTED_DEPENDENCY_VERSION");
  }
  return DEPENDENCY_CONTRACT_VERSION;
}

function parseUniqueCodes<T extends string>(
  value: unknown,
  unknownCode: DependencyErrorCode,
  duplicateCode: DependencyErrorCode,
): readonly T[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new DependencyError(unknownCode);
  }
  const parsed = value.map((entry) => parseCode(entry, unknownCode) as T);
  if (new Set(parsed).size !== parsed.length) {
    throw new DependencyError(duplicateCode);
  }
  return Object.freeze([...parsed].sort());
}

export function validateDependencyDefinition(
  input: unknown,
): DependencyDefinition {
  if (!isPlainRecord(input) || !hasExactKeys(input, DEFINITION_KEYS)) {
    throw new DependencyError("INVALID_DEPENDENCY_INPUT");
  }

  return Object.freeze({
    dependencyTypes: parseUniqueCodes<DependencyType>(
      input.dependencyTypes,
      "UNKNOWN_DEPENDENCY_TYPE",
      "DUPLICATE_DEPENDENCY_TYPE",
    ),
    resourceTypes: parseUniqueCodes<DependencyResourceType>(
      input.resourceTypes,
      "UNKNOWN_DEPENDENCY_RESOURCE",
      "DUPLICATE_DEPENDENCY_RESOURCE_TYPE",
    ),
    transitions: parseUniqueCodes<DependencyTransition>(
      input.transitions,
      "UNKNOWN_DEPENDENCY_TRANSITION",
      "DUPLICATE_DEPENDENCY_TRANSITION",
    ),
    version: parseVersion(input.version),
  });
}

function includesCode(values: readonly string[], value: string): boolean {
  return values.includes(value);
}

export function validateDependencyCheckRequest(
  input: unknown,
  definition: DependencyDefinition,
): DependencyCheckRequest {
  if (!isPlainRecord(input) || !hasExactKeys(input, REQUEST_KEYS)) {
    throw new DependencyError("INVALID_DEPENDENCY_INPUT");
  }

  const version = parseVersion(input.version);
  if (version !== definition.version) {
    throw new DependencyError("UNSUPPORTED_DEPENDENCY_VERSION");
  }
  const resourceType = parseCode(
    input.resourceType,
    "UNKNOWN_DEPENDENCY_RESOURCE",
  ) as DependencyResourceType;
  if (!includesCode(definition.resourceTypes, resourceType)) {
    throw new DependencyError("UNKNOWN_DEPENDENCY_RESOURCE");
  }
  const requestedTransition = parseCode(
    input.requestedTransition,
    "UNKNOWN_DEPENDENCY_TRANSITION",
  ) as DependencyTransition;
  if (!includesCode(definition.transitions, requestedTransition)) {
    throw new DependencyError("UNKNOWN_DEPENDENCY_TRANSITION");
  }

  return Object.freeze({
    requestedTransition,
    resourceId: parseResourceId(input.resourceId),
    resourceType,
    version,
  });
}

function parseReference(
  input: unknown,
  definition: DependencyDefinition,
): DependencyReference {
  if (!isPlainRecord(input) || !hasExactKeys(input, REFERENCE_KEYS)) {
    throw new DependencyError("INVALID_DEPENDENCY_GRAPH_RESULT");
  }
  const version = parseVersion(input.version);
  if (version !== definition.version) {
    throw new DependencyError("UNSUPPORTED_DEPENDENCY_VERSION");
  }
  const resourceType = parseCode(
    input.resourceType,
    "UNKNOWN_DEPENDENCY_RESOURCE",
  ) as DependencyResourceType;
  const relatedResourceType = parseCode(
    input.relatedResourceType,
    "UNKNOWN_DEPENDENCY_RESOURCE",
  ) as DependencyResourceType;
  if (
    !includesCode(definition.resourceTypes, resourceType) ||
    !includesCode(definition.resourceTypes, relatedResourceType)
  ) {
    throw new DependencyError("UNKNOWN_DEPENDENCY_RESOURCE");
  }
  const dependencyType = parseCode(
    input.dependencyType,
    "UNKNOWN_DEPENDENCY_TYPE",
  ) as DependencyType;
  if (!includesCode(definition.dependencyTypes, dependencyType)) {
    throw new DependencyError("UNKNOWN_DEPENDENCY_TYPE");
  }
  if (
    typeof input.direction !== "string" ||
    !(DEPENDENCY_DIRECTIONS as readonly string[]).includes(input.direction) ||
    typeof input.readonly !== "boolean"
  ) {
    throw new DependencyError("INVALID_DEPENDENCY_GRAPH_RESULT");
  }

  return Object.freeze({
    dependencyType,
    direction: input.direction as DependencyDirection,
    readonly: input.readonly,
    relatedResourceId: parseResourceId(input.relatedResourceId),
    relatedResourceType,
    resourceId: parseResourceId(input.resourceId),
    resourceType,
    version,
  });
}

function nodeKey(resourceType: string, resourceId: string): string {
  return `${resourceType}:${resourceId}`;
}

function directedEdge(
  reference: DependencyReference,
): readonly [string, string] {
  const resource = nodeKey(reference.resourceType, reference.resourceId);
  const related = nodeKey(
    reference.relatedResourceType,
    reference.relatedResourceId,
  );
  return reference.direction === "OUTBOUND"
    ? [resource, related]
    : [related, resource];
}

function referenceKey(reference: DependencyReference): string {
  const [from, to] = directedEdge(reference);
  return `${from}->${to}:${reference.dependencyType}@${reference.version}`;
}

function assertConnected(
  request: DependencyCheckRequest,
  references: readonly DependencyReference[],
): void {
  if (references.length === 0) return;
  const root = nodeKey(request.resourceType, request.resourceId);
  const adjacency = new Map<string, Set<string>>();
  for (const reference of references) {
    const [from, to] = directedEdge(reference);
    const fromEdges = adjacency.get(from) ?? new Set<string>();
    const toEdges = adjacency.get(to) ?? new Set<string>();
    fromEdges.add(to);
    toEdges.add(from);
    adjacency.set(from, fromEdges);
    adjacency.set(to, toEdges);
  }
  if (!adjacency.has(root)) {
    throw new DependencyError("DISCONNECTED_DEPENDENCY_GRAPH");
  }

  const visited = new Set<string>();
  const pending = [root];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || visited.has(current)) continue;
    visited.add(current);
    for (const next of adjacency.get(current) ?? []) pending.push(next);
  }
  if (visited.size !== adjacency.size) {
    throw new DependencyError("DISCONNECTED_DEPENDENCY_GRAPH");
  }
}

function assertAcyclic(references: readonly DependencyReference[]): void {
  const adjacency = new Map<string, Set<string>>();
  const indegree = new Map<string, number>();
  for (const reference of references) {
    const [from, to] = directedEdge(reference);
    const edges = adjacency.get(from) ?? new Set<string>();
    edges.add(to);
    adjacency.set(from, edges);
    if (!adjacency.has(to)) adjacency.set(to, new Set<string>());
    if (!indegree.has(from)) indegree.set(from, 0);
    indegree.set(to, (indegree.get(to) ?? 0) + 1);
  }

  const pending = [...indegree.entries()]
    .filter(([, count]) => count === 0)
    .map(([node]) => node);
  let visitedCount = 0;
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    visitedCount += 1;
    for (const next of adjacency.get(current) ?? []) {
      const nextIndegree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, nextIndegree);
      if (nextIndegree === 0) pending.push(next);
    }
  }
  if (visitedCount !== adjacency.size) {
    throw new DependencyError("CIRCULAR_DEPENDENCY");
  }
}

export function validateDependencyReferences(
  input: unknown,
  request: DependencyCheckRequest,
  definition: DependencyDefinition,
): readonly DependencyReference[] {
  if (!Array.isArray(input)) {
    throw new DependencyError("INVALID_DEPENDENCY_GRAPH_RESULT");
  }
  if (input.length > MAX_DEPENDENCY_REFERENCES) {
    throw new DependencyError("INVALID_DEPENDENCY_GRAPH_RESULT");
  }
  const references = input.map((entry) => parseReference(entry, definition));
  const keys = references.map(referenceKey);
  if (new Set(keys).size !== keys.length) {
    throw new DependencyError("DUPLICATE_DEPENDENCY_REFERENCE");
  }
  assertConnected(request, references);
  assertAcyclic(references);
  return Object.freeze(
    [...references].sort((left, right) => {
      const leftKey = referenceKey(left);
      const rightKey = referenceKey(right);
      if (leftKey === rightKey) return 0;
      return leftKey < rightKey ? -1 : 1;
    }),
  );
}

export function validateDependencyPolicyResult(
  input: unknown,
): DependencyPolicyResult {
  if (!isPlainRecord(input) || typeof input.decision !== "string") {
    throw new DependencyError("INVALID_DEPENDENCY_POLICY_RESULT");
  }
  if (input.decision === "ALLOW" && hasExactKeys(input, ["decision"])) {
    return Object.freeze({ decision: "ALLOW" });
  }
  if (
    input.decision === "DENY" &&
    hasExactKeys(input, ["decision", "reason"]) &&
    input.reason === "DEPENDENCY_POLICY_DENIED"
  ) {
    return Object.freeze({
      decision: "DENY",
      reason: "DEPENDENCY_POLICY_DENIED",
    });
  }
  throw new DependencyError("INVALID_DEPENDENCY_POLICY_RESULT");
}
