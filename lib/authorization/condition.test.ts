import {
  evaluatePolicyCondition,
  validatePolicyCondition,
} from "@/lib/authorization";

const attributes = Object.freeze({
  category: "CURRICULUM",
  labels: Object.freeze(["draft", "internal"]),
  published: false,
  revision: 3,
});

describe("policy condition evaluator", () => {
  it.each([
    [{ attribute: "category", operator: "equals", value: "CURRICULUM" }, true],
    [{ attribute: "category", operator: "notEquals", value: "LESSON" }, true],
    [{ attribute: "labels", operator: "includes", value: "draft" }, true],
    [{ attribute: "published", operator: "exists" }, true],
    [{ attribute: "revision", operator: "equals", value: 4 }, false],
  ] as const)("evaluates %o", (condition, expected) => {
    const result = evaluatePolicyCondition(condition, attributes);
    expect(result.matches).toBe(expected);
    expect(result.status).toBe(expected ? "MATCH" : "NO_MATCH");
  });

  it("evaluates nested all and any expressions deterministically", () => {
    const condition = {
      conditions: [
        { attribute: "category", operator: "equals", value: "CURRICULUM" },
        {
          conditions: [
            { attribute: "labels", operator: "includes", value: "approved" },
            { attribute: "labels", operator: "includes", value: "draft" },
          ],
          operator: "any",
        },
      ],
      operator: "all",
    } as const;

    expect(validatePolicyCondition(condition)).toBe("VALID");
    expect(evaluatePolicyCondition(condition, attributes)).toEqual({
      matches: true,
      status: "MATCH",
    });
  });

  it("fails closed when an attribute is absent", () => {
    expect(
      evaluatePolicyCondition(
        { attribute: "missing", operator: "equals", value: "x" },
        attributes,
      ),
    ).toEqual({ matches: false, status: "MISSING_ATTRIBUTE" });
  });

  it.each([
    [
      { attribute: "category", operator: "startsWith", value: "CUR" },
      "UNSUPPORTED_OPERATOR",
    ],
    [{ operator: "equals", value: "CURRICULUM" }, "INVALID_CONDITION"],
    [{ conditions: [], operator: "all" }, "INVALID_CONDITION"],
    [
      { attribute: "labels", operator: "includes", value: { unsafe: true } },
      "INVALID_CONDITION",
    ],
  ] as const)(
    "rejects unsafe or malformed condition %o",
    (condition, status) => {
      expect(validatePolicyCondition(condition)).toBe(status);
      expect(evaluatePolicyCondition(condition, attributes).matches).toBe(
        false,
      );
    },
  );

  it("does not mutate condition attributes", () => {
    const before = JSON.stringify(attributes);
    evaluatePolicyCondition(
      { attribute: "labels", operator: "includes", value: "draft" },
      attributes,
    );
    expect(JSON.stringify(attributes)).toBe(before);
  });
});
