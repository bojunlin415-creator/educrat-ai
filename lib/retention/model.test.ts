import {
  createAllowedRetentionDecision,
  createDeniedRetentionDecision,
  validateLegalHoldReferences,
  validateRetentionCheckRequest,
  validateRetentionRegistryDefinition,
} from "@/lib/retention";

const registry = validateRetentionRegistryDefinition({
  definitions: [
    {
      legalHoldSupported: true,
      metadata: [{ key: "POLICY_CLASS", value: "STANDARD" }],
      minimumRetentionPeriod: { amount: 30, unit: "DAYS" },
      resourceType: "RECORD",
      retentionCategory: "BUSINESS",
      version: 1,
    },
  ],
  retentionCategories: ["BUSINESS"],
  transitions: ["DELETE"],
  version: 1,
});

const request = validateRetentionCheckRequest(
  {
    requestedTransition: "DELETE",
    resourceId: "record-1",
    resourceType: "RECORD",
    version: 1,
  },
  registry,
);

const definition = registry.definitions[0];
if (!definition) throw new Error("Test fixture requires a definition");

describe("retention models", () => {
  it("creates a deeply frozen retention definition", () => {
    expect(definition).toEqual({
      legalHoldSupported: true,
      metadata: [{ key: "POLICY_CLASS", value: "STANDARD" }],
      minimumRetentionPeriod: { amount: 30, unit: "DAYS" },
      resourceType: "RECORD",
      retentionCategory: "BUSINESS",
      version: 1,
    });
    expect(Object.isFrozen(definition)).toBe(true);
    expect(Object.isFrozen(definition.metadata)).toBe(true);
    expect(Object.isFrozen(definition.metadata[0])).toBe(true);
    expect(Object.isFrozen(definition.minimumRetentionPeriod)).toBe(true);
  });

  it("creates immutable legal hold references", () => {
    const holds = validateLegalHoldReferences(
      [
        {
          active: false,
          holdId: "hold-1",
          holdReason: "LEGAL_REVIEW",
          resourceId: "record-1",
          resourceType: "RECORD",
          version: 1,
        },
      ],
      request,
      definition,
    );

    expect(holds).toEqual([
      {
        active: false,
        holdId: "hold-1",
        holdReason: "LEGAL_REVIEW",
        resourceId: "record-1",
        resourceType: "RECORD",
        version: 1,
      },
    ]);
    expect(Object.isFrozen(holds)).toBe(true);
    expect(Object.isFrozen(holds[0])).toBe(true);
  });

  it("creates immutable allowed requirements and evaluation", () => {
    const result = createAllowedRetentionDecision({
      legalHoldCount: 1,
      legalHoldSupported: definition.legalHoldSupported,
      metadata: definition.metadata,
      minimumRetentionPeriod: definition.minimumRetentionPeriod,
      retentionCategory: definition.retentionCategory,
    });

    expect(result).toEqual({
      decision: "ALLOWED",
      evaluation: {
        activeLegalHoldCount: 0,
        legalHoldCount: 1,
        policyDecision: "ALLOW",
        validation: "PASSED",
      },
      requirements: {
        legalHoldCheck: "PASSED",
        metadata: [{ key: "POLICY_CLASS", value: "STANDARD" }],
        minimumRetentionPeriod: { amount: 30, unit: "DAYS" },
        retentionCategory: "BUSINESS",
      },
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.evaluation)).toBe(true);
    expect(Object.isFrozen(result.requirements)).toBe(true);
    expect(Object.isFrozen(result.requirements.metadata)).toBe(true);
    expect(Object.isFrozen(result.requirements.minimumRetentionPeriod)).toBe(
      true,
    );
  });

  it("creates immutable denied decisions without returning rule or hold data", () => {
    const result = createDeniedRetentionDecision(
      "LEGAL_HOLD_ACTIVE",
      "LEGAL_HOLD_IS_ACTIVE",
    );

    expect(result).toEqual({
      decision: "DENIED",
      denialCode: "LEGAL_HOLD_ACTIVE",
      reason: "LEGAL_HOLD_IS_ACTIVE",
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect("requirements" in result).toBe(false);
    expect("legalHolds" in result).toBe(false);
  });
});
