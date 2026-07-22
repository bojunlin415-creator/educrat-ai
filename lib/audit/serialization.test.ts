import {
  AuditError,
  canonicalSerialize,
  serializeAuditEventForHash,
  type AuditEventHashMaterial,
} from "@/lib/audit";

describe("canonical audit serialization", () => {
  it("sorts object keys recursively", () => {
    const first = canonicalSerialize({ z: 1, nested: { b: 2, a: 1 }, a: 0 });
    const second = canonicalSerialize({ a: 0, nested: { a: 1, b: 2 }, z: 1 });

    expect(first).toBe(second);
    expect(first).toBe('{"a":0,"nested":{"a":1,"b":2},"z":1}');
  });

  it("normalizes Unicode and negative zero while preserving array order", () => {
    expect(canonicalSerialize({ value: "e\u0301", zero: -0 })).toBe(
      canonicalSerialize({ zero: 0, value: "é" }),
    );
    expect(canonicalSerialize(["first", "second"])).not.toBe(
      canonicalSerialize(["second", "first"]),
    );
  });

  it.each([
    ["undefined", { value: undefined }],
    ["date", { value: new Date("2026-07-22T00:00:00.000Z") }],
    ["non-finite", { value: Number.NaN }],
    ["symbol key", { [Symbol("secret")]: "value" }],
  ])("rejects %s", (_name, input) => {
    expect(() => canonicalSerialize(input)).toThrow(AuditError);
  });

  it("rejects cycles and accessors without evaluating getters", () => {
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    const getter = vi.fn(() => "secret");
    const withGetter = Object.defineProperty({}, "value", { get: getter });

    expect(() => canonicalSerialize(cyclic)).toThrow(AuditError);
    expect(() => canonicalSerialize(withGetter)).toThrow(AuditError);
    expect(getter).not.toHaveBeenCalled();
  });

  it("serializes complete hash material deterministically", () => {
    const material: AuditEventHashMaterial = {
      action: "ENTITY_ARCHIVED",
      actorId: "account-1",
      actorType: "ACCOUNT",
      correlationId: "correlation-1",
      eventId: "audit-event-1",
      metadata: Object.freeze({ stateAfter: "ARCHIVED" }),
      occurredAt: "2026-07-22T02:00:00.000Z",
      organizationId: "organization-1",
      platformScope: false,
      previousHash: null,
      reason: "USER_REQUEST",
      requestId: "request-1",
      resourceId: "curriculum-1",
      resourceType: "CURRICULUM",
      result: "SUCCEEDED",
      source: "DOMAIN_SERVICE",
      version: 1,
    };

    expect(serializeAuditEventForHash(material)).toBe(
      serializeAuditEventForHash({ ...material }),
    );
  });
});
