export type ConditionPrimitive = string | number | boolean | null;
export type ConditionAttributeValue =
  ConditionPrimitive | readonly ConditionPrimitive[];
export type ConditionAttributes = Readonly<
  Record<string, ConditionAttributeValue>
>;

export type PolicyCondition =
  | Readonly<{
      attribute: string;
      operator: "equals";
      value: ConditionPrimitive;
    }>
  | Readonly<{
      attribute: string;
      operator: "notEquals";
      value: ConditionPrimitive;
    }>
  | Readonly<{
      attribute: string;
      operator: "includes";
      value: ConditionPrimitive;
    }>
  | Readonly<{ attribute: string; operator: "exists" }>
  | Readonly<{ conditions: readonly PolicyCondition[]; operator: "all" }>
  | Readonly<{ conditions: readonly PolicyCondition[]; operator: "any" }>;

export const CONDITION_EVALUATION_STATUSES = [
  "MATCH",
  "NO_MATCH",
  "MISSING_ATTRIBUTE",
  "INVALID_CONDITION",
  "UNSUPPORTED_OPERATOR",
] as const;

export type ConditionEvaluationStatus =
  (typeof CONDITION_EVALUATION_STATUSES)[number];

export interface ConditionEvaluationResult {
  readonly matches: boolean;
  readonly status: ConditionEvaluationStatus;
}

const MAX_CONDITION_DEPTH = 12;

export type ConditionValidationStatus =
  "VALID" | "INVALID_CONDITION" | "UNSUPPORTED_OPERATOR";

function isPrimitive(value: unknown): value is ConditionPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    (typeof value === "number" && Number.isFinite(value)) ||
    typeof value === "boolean"
  );
}

export function isConditionAttributes(
  value: unknown,
): value is ConditionAttributes {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(
    (attribute) =>
      isPrimitive(attribute) ||
      (Array.isArray(attribute) && attribute.every(isPrimitive)),
  );
}

function isAttributeName(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-zA-Z0-9_.]{0,126}$/.test(value);
}

function validateInternal(
  condition: unknown,
  depth: number,
): ConditionValidationStatus {
  if (
    depth > MAX_CONDITION_DEPTH ||
    typeof condition !== "object" ||
    condition === null
  ) {
    return "INVALID_CONDITION";
  }
  const candidate = condition as Readonly<Record<string, unknown>>;
  const operator = candidate.operator;
  if (typeof operator !== "string") return "INVALID_CONDITION";

  if (operator === "all" || operator === "any") {
    if (
      !Array.isArray(candidate.conditions) ||
      candidate.conditions.length === 0
    ) {
      return "INVALID_CONDITION";
    }
    for (const child of candidate.conditions) {
      const status = validateInternal(child, depth + 1);
      if (status !== "VALID") return status;
    }
    return "VALID";
  }

  if (!isAttributeName(candidate.attribute)) return "INVALID_CONDITION";
  if (operator === "exists") return "VALID";
  if (
    operator === "equals" ||
    operator === "notEquals" ||
    operator === "includes"
  ) {
    return isPrimitive(candidate.value) ? "VALID" : "INVALID_CONDITION";
  }
  return "UNSUPPORTED_OPERATOR";
}

export function validatePolicyCondition(
  condition: unknown,
): ConditionValidationStatus {
  return validateInternal(condition, 0);
}

function readAttribute(
  attributes: ConditionAttributes,
  attribute: string,
): { exists: boolean; value?: ConditionAttributeValue } {
  if (!Object.prototype.hasOwnProperty.call(attributes, attribute)) {
    return { exists: false };
  }
  return { exists: true, value: attributes[attribute] };
}

function evaluateInternal(
  condition: unknown,
  attributes: ConditionAttributes,
  depth: number,
): ConditionEvaluationResult {
  if (
    depth > MAX_CONDITION_DEPTH ||
    typeof condition !== "object" ||
    condition === null
  ) {
    return { matches: false, status: "INVALID_CONDITION" };
  }

  const candidate = condition as Readonly<Record<string, unknown>>;
  const operator = candidate.operator;
  if (typeof operator !== "string") {
    return { matches: false, status: "INVALID_CONDITION" };
  }

  if (operator === "all" || operator === "any") {
    if (
      !Array.isArray(candidate.conditions) ||
      candidate.conditions.length === 0
    ) {
      return { matches: false, status: "INVALID_CONDITION" };
    }
    const results = candidate.conditions.map((child) =>
      evaluateInternal(child, attributes, depth + 1),
    );
    const invalid = results.find(
      (result) =>
        result.status === "INVALID_CONDITION" ||
        result.status === "UNSUPPORTED_OPERATOR" ||
        result.status === "MISSING_ATTRIBUTE",
    );
    if (invalid) return invalid;
    return {
      matches:
        operator === "all"
          ? results.every((result) => result.matches)
          : results.some((result) => result.matches),
      status: (
        operator === "all"
          ? results.every((result) => result.matches)
          : results.some((result) => result.matches)
      )
        ? "MATCH"
        : "NO_MATCH",
    };
  }

  if (!isAttributeName(candidate.attribute)) {
    return { matches: false, status: "INVALID_CONDITION" };
  }
  const attribute = readAttribute(attributes, candidate.attribute);
  if (!attribute.exists) {
    return { matches: false, status: "MISSING_ATTRIBUTE" };
  }

  if (operator === "exists") {
    return { matches: true, status: "MATCH" };
  }
  if (!isPrimitive(candidate.value)) {
    return { matches: false, status: "INVALID_CONDITION" };
  }

  if (operator === "equals" || operator === "notEquals") {
    if (Array.isArray(attribute.value)) {
      return { matches: false, status: "INVALID_CONDITION" };
    }
    const equals = attribute.value === candidate.value;
    const matches = operator === "equals" ? equals : !equals;
    return { matches, status: matches ? "MATCH" : "NO_MATCH" };
  }
  if (operator === "includes") {
    if (!Array.isArray(attribute.value)) {
      return { matches: false, status: "INVALID_CONDITION" };
    }
    const matches = attribute.value.includes(candidate.value);
    return { matches, status: matches ? "MATCH" : "NO_MATCH" };
  }

  return { matches: false, status: "UNSUPPORTED_OPERATOR" };
}

export function evaluatePolicyCondition(
  condition: unknown,
  attributes: ConditionAttributes,
): ConditionEvaluationResult {
  return evaluateInternal(condition, attributes, 0);
}
