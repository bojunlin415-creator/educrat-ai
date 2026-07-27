import {
  RetentionError,
  type RetentionErrorCode,
  RetentionRegistry,
  validateLegalHoldReferences,
  validateRetentionCheckRequest,
  validateRetentionRegistryDefinition,
} from "@/lib/retention";

const registry = new RetentionRegistry({
  definitions: [
    {
      legalHoldSupported: true,
      metadata: [{ key: "SOURCE", value: "PLATFORM" }],
      minimumRetentionPeriod: { amount: 30, unit: "DAYS" },
      resourceType: "RECORD",
      retentionCategory: "BUSINESS",
      version: 1,
    },
    {
      legalHoldSupported: false,
      metadata: [],
      minimumRetentionPeriod: { amount: 0, unit: "DAYS" },
      resourceType: "EPHEMERAL",
      retentionCategory: "SECURITY",
      version: 1,
    },
  ],
  retentionCategories: ["BUSINESS", "SECURITY"],
  transitions: ["ARCHIVE", "DELETE"],
  version: 1,
});

function requestInput(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    requestedTransition: "DELETE",
    resourceId: "record-1",
    resourceType: "RECORD",
    version: 1,
    ...overrides,
  };
}

function holdInput(
  overrides: Readonly<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    active: false,
    holdId: "hold-1",
    holdReason: "LEGAL_REVIEW",
    resourceId: "record-1",
    resourceType: "RECORD",
    version: 1,
    ...overrides,
  };
}

function expectRetentionError(
  action: () => unknown,
  code: RetentionErrorCode,
): void {
  expect(action).toThrowError(
    expect.objectContaining<Partial<RetentionError>>({ code }),
  );
}

describe("retention validation", () => {
  it("rejects unknown resources and transitions", () => {
    expectRetentionError(
      () =>
        validateRetentionCheckRequest(
          requestInput({ resourceType: "UNKNOWN" }),
          registry.definition,
        ),
      "UNKNOWN_RETENTION_RESOURCE",
    );
    expectRetentionError(
      () =>
        validateRetentionCheckRequest(
          requestInput({ requestedTransition: "PURGE" }),
          registry.definition,
        ),
      "UNKNOWN_RETENTION_TRANSITION",
    );
  });

  it("rejects unknown fields, symbols, and accessors", () => {
    expectRetentionError(
      () =>
        validateRetentionCheckRequest(
          requestInput({ token: "forbidden" }),
          registry.definition,
        ),
      "INVALID_RETENTION_INPUT",
    );
    const symbolInput = requestInput();
    Object.defineProperty(symbolInput, Symbol("hidden"), { value: true });
    expectRetentionError(
      () => validateRetentionCheckRequest(symbolInput, registry.definition),
      "INVALID_RETENTION_INPUT",
    );
    const accessorInput = requestInput();
    Object.defineProperty(accessorInput, "resourceId", {
      enumerable: true,
      get: () => "record-1",
    });
    expectRetentionError(
      () => validateRetentionCheckRequest(accessorInput, registry.definition),
      "INVALID_RETENTION_INPUT",
    );
  });

  it("rejects unknown categories and invalid rules", () => {
    const source = {
      definitions: [
        {
          legalHoldSupported: true,
          metadata: [],
          minimumRetentionPeriod: { amount: 1, unit: "DAYS" },
          resourceType: "RECORD",
          retentionCategory: "UNKNOWN",
          version: 1,
        },
      ],
      retentionCategories: ["BUSINESS"],
      transitions: ["DELETE"],
      version: 1,
    };
    expectRetentionError(
      () => validateRetentionRegistryDefinition(source),
      "UNKNOWN_RETENTION_CATEGORY",
    );
    expectRetentionError(
      () =>
        validateRetentionRegistryDefinition({
          ...source,
          definitions: [
            {
              ...source.definitions[0],
              minimumRetentionPeriod: { amount: -1, unit: "DAYS" },
              retentionCategory: "BUSINESS",
            },
          ],
        }),
      "INVALID_RETENTION_RULE",
    );
  });

  it("rejects unsafe or duplicate metadata", () => {
    const baseDefinition = registry.getDefinition("RECORD");
    if (!baseDefinition) throw new Error("Test fixture requires a definition");

    for (const metadata of [
      [{ key: "CONTACT", value: "student@example.test" }],
      [
        { key: "SOURCE", value: "PLATFORM" },
        { key: "SOURCE", value: "LEGAL" },
      ],
    ]) {
      expectRetentionError(
        () =>
          validateRetentionRegistryDefinition({
            definitions: [{ ...baseDefinition, metadata }],
            retentionCategories: ["BUSINESS"],
            transitions: ["DELETE"],
            version: 1,
          }),
        "INVALID_RETENTION_RULE",
      );
    }
  });

  it("rejects malformed, cross-resource, duplicate, and unsupported holds", () => {
    const request = validateRetentionCheckRequest(
      requestInput(),
      registry.definition,
    );
    const definition = registry.getDefinition("RECORD");
    if (!definition) throw new Error("Test fixture requires a definition");

    expectRetentionError(
      () =>
        validateLegalHoldReferences(
          [holdInput({ resourceId: "other-1" })],
          request,
          definition,
        ),
      "INVALID_LEGAL_HOLD",
    );
    expectRetentionError(
      () =>
        validateLegalHoldReferences(
          [holdInput({ resourceId: "student@example.test" })],
          request,
          definition,
        ),
      "INVALID_LEGAL_HOLD",
    );
    expectRetentionError(
      () =>
        validateLegalHoldReferences(
          [holdInput(), holdInput()],
          request,
          definition,
        ),
      "DUPLICATE_LEGAL_HOLD",
    );
    expectRetentionError(
      () =>
        validateLegalHoldReferences(
          [holdInput({ version: 2 })],
          request,
          definition,
        ),
      "UNSUPPORTED_RETENTION_VERSION",
    );
  });

  it("rejects holds for definitions that do not support legal holds", () => {
    const request = validateRetentionCheckRequest(
      requestInput({
        resourceId: "ephemeral-1",
        resourceType: "EPHEMERAL",
      }),
      registry.definition,
    );
    const definition = registry.getDefinition("EPHEMERAL");
    if (!definition) throw new Error("Test fixture requires a definition");

    expectRetentionError(
      () =>
        validateLegalHoldReferences(
          [
            holdInput({
              resourceId: "ephemeral-1",
              resourceType: "EPHEMERAL",
            }),
          ],
          request,
          definition,
        ),
      "INVALID_LEGAL_HOLD",
    );
  });

  it("rejects unsupported contract versions and PII-shaped identifiers", () => {
    expectRetentionError(
      () =>
        validateRetentionCheckRequest(
          requestInput({ version: 2 }),
          registry.definition,
        ),
      "UNSUPPORTED_RETENTION_VERSION",
    );
    expectRetentionError(
      () =>
        validateRetentionCheckRequest(
          requestInput({ resourceId: "student@example.test" }),
          registry.definition,
        ),
      "INVALID_RETENTION_INPUT",
    );
  });
});
