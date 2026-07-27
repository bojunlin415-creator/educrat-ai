import {
  RetentionError,
  RetentionRegistry,
  serializeRetentionSnapshot,
} from "@/lib/retention";

const registry = new RetentionRegistry({
  definitions: [
    {
      legalHoldSupported: true,
      metadata: [
        { key: "SOURCE", value: "PLATFORM" },
        { key: "CLASSIFICATION", value: "STANDARD" },
      ],
      minimumRetentionPeriod: { amount: 1, unit: "YEARS" },
      resourceType: "RECORD",
      retentionCategory: "BUSINESS",
      version: 1,
    },
  ],
  retentionCategories: ["BUSINESS"],
  transitions: ["DELETE"],
  version: 1,
});

const request = {
  requestedTransition: "DELETE",
  resourceId: "record-1",
  resourceType: "RECORD",
  version: 1,
};

const holdOne = {
  active: false,
  holdId: "hold-1",
  holdReason: "LEGAL_REVIEW",
  resourceId: "record-1",
  resourceType: "RECORD",
  version: 1,
};

const holdTwo = {
  active: false,
  holdId: "hold-2",
  holdReason: "SECURITY_REVIEW",
  resourceId: "record-1",
  resourceType: "RECORD",
  version: 1,
};

const definition = {
  legalHoldSupported: true,
  metadata: [
    { key: "SOURCE", value: "PLATFORM" },
    { key: "CLASSIFICATION", value: "STANDARD" },
  ],
  minimumRetentionPeriod: { amount: 1, unit: "YEARS" },
  resourceType: "RECORD",
  retentionCategory: "BUSINESS",
  version: 1,
};

describe("canonical retention serialization", () => {
  it("is deterministic across key, metadata, and hold ordering", () => {
    const first = serializeRetentionSnapshot(
      {
        definition,
        legalHolds: [holdTwo, holdOne],
        request,
      },
      registry.definition,
    );
    const second = serializeRetentionSnapshot(
      {
        request: {
          version: 1,
          resourceType: "RECORD",
          resourceId: "record-1",
          requestedTransition: "DELETE",
        },
        legalHolds: [holdOne, holdTwo],
        definition: {
          version: 1,
          retentionCategory: "BUSINESS",
          resourceType: "RECORD",
          minimumRetentionPeriod: { unit: "YEARS", amount: 1 },
          metadata: [...definition.metadata].reverse(),
          legalHoldSupported: true,
        },
      },
      registry.definition,
    );

    expect(first).toBe(second);
    expect(JSON.parse(first)).toEqual({
      definition: {
        legalHoldSupported: true,
        metadata: [
          { key: "CLASSIFICATION", value: "STANDARD" },
          { key: "SOURCE", value: "PLATFORM" },
        ],
        minimumRetentionPeriod: { amount: 1, unit: "YEARS" },
        resourceType: "RECORD",
        retentionCategory: "BUSINESS",
        version: 1,
      },
      legalHolds: [holdOne, holdTwo],
      request,
    });
  });

  it("fails closed on unknown fields and a non-canonical rule", () => {
    expect(() =>
      serializeRetentionSnapshot(
        { definition, legalHolds: [], request, token: "forbidden" },
        registry.definition,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<RetentionError>>({
        code: "INVALID_RETENTION_INPUT",
      }),
    );
    expect(() =>
      serializeRetentionSnapshot(
        {
          definition: {
            ...definition,
            minimumRetentionPeriod: { amount: 0, unit: "DAYS" },
          },
          legalHolds: [],
          request,
        },
        registry.definition,
      ),
    ).toThrowError(
      expect.objectContaining<Partial<RetentionError>>({
        code: "INVALID_RETENTION_RULE",
      }),
    );
  });
});
