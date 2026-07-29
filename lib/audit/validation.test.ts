import {
  AuditError,
  createImmutableAuditEvent,
  validateAuditMetadata,
  validateAuditTimestamp,
  validateAuditWriteCommand,
} from "@/lib/audit";

function command(): Readonly<Record<string, unknown>> {
  return {
    action: "MEMBERSHIP_SUSPENDED",
    actorId: "account-1",
    actorType: "ACCOUNT",
    correlationId: "correlation-1",
    metadata: { impactCount: 1, stateAfter: "SUSPENDED" },
    organizationId: "organization-1",
    platformScope: false,
    reason: "POLICY_ENFORCEMENT",
    requestId: "request-1",
    resourceId: "membership-1",
    resourceType: "MEMBERSHIP",
    result: "SUCCEEDED",
    source: "DOMAIN_SERVICE",
  };
}

describe("audit validation", () => {
  it("accepts organization and platform scoped commands", () => {
    expect(validateAuditWriteCommand(command()).organizationId).toBe(
      "organization-1",
    );
    expect(
      validateAuditWriteCommand({
        ...command(),
        organizationId: null,
        platformScope: true,
      }).platformScope,
    ).toBe(true);
  });

  it.each([
    [
      "missing actor",
      { ...command(), actorId: undefined },
      "INVALID_AUDIT_ACTOR",
    ],
    [
      "invalid scope",
      { ...command(), organizationId: null },
      "INVALID_AUDIT_SCOPE",
    ],
    [
      "missing resource",
      { ...command(), resourceId: undefined },
      "INVALID_AUDIT_RESOURCE",
    ],
    [
      "invalid action",
      { ...command(), action: "archive" },
      "INVALID_AUDIT_ACTION",
    ],
    [
      "unknown root field",
      { ...command(), secret: "value" },
      "INVALID_AUDIT_INPUT",
    ],
  ])("rejects %s", (_name, input, code) => {
    expect(() => validateAuditWriteCommand(input)).toThrowError(
      expect.objectContaining({ code }),
    );
  });

  it("rejects metadata outside the allowlist or containing likely PII", () => {
    expect(validateAuditMetadata({ curriculumVersionId: "version-1" })).toEqual(
      { curriculumVersionId: "version-1" },
    );
    expect(() =>
      validateAuditMetadata({ email: "person@example.com" }),
    ).toThrow(AuditError);
    expect(() =>
      validateAuditMetadata({ purposeCode: "person@example.com" }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_AUDIT_METADATA" }));
    expect(() => validateAuditMetadata({ impactCount: -1 })).toThrowError(
      expect.objectContaining({ code: "INVALID_AUDIT_METADATA" }),
    );
  });

  it("rejects malformed and impossible timestamps with a stable error", () => {
    expect(() =>
      validateAuditTimestamp("2026-99-99T00:00:00.000Z"),
    ).toThrowError(
      expect.objectContaining({ code: "INVALID_AUDIT_TIMESTAMP" }),
    );
    expect(() => validateAuditTimestamp("2026-07-22T02:00:00Z")).toThrowError(
      expect.objectContaining({ code: "INVALID_AUDIT_TIMESTAMP" }),
    );
  });

  it("creates a frozen event and rejects invalid hash or version", () => {
    const eventInput = {
      ...command(),
      currentHash: "d".repeat(64),
      eventId: "audit-event-1",
      occurredAt: "2026-07-22T02:00:00.000Z",
      previousHash: null,
      version: 1,
    };
    const event = createImmutableAuditEvent(eventInput);

    expect(Object.isFrozen(event)).toBe(true);
    expect(Object.isFrozen(event.metadata)).toBe(true);
    expect(() =>
      createImmutableAuditEvent({ ...eventInput, currentHash: "not-a-hash" }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_AUDIT_HASH" }));
    expect(() =>
      createImmutableAuditEvent({ ...eventInput, version: 2 }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_AUDIT_VERSION" }));
  });
});
