import { createHash } from "node:crypto";

import {
  AuditWriter,
  type AuditAppendExpectation,
  type AuditChainHead,
  type AuditEvent,
  type AuditHashChain,
  type AuditRepository,
  type AuditWriteCommand,
  type CanonicalAuditPayload,
} from "@/lib/audit";

const occurredAt = "2026-07-22T02:00:00.000Z";
const eventId = "audit-event-1";

function validCommand(
  overrides: Partial<AuditWriteCommand> = {},
): AuditWriteCommand {
  return {
    action: "CURRICULUM_ARCHIVED",
    actingRole: "ORGANIZATION_OWNER",
    actorId: "account-1",
    actorType: "ACCOUNT",
    correlationId: "correlation-1",
    metadata: {
      operationClass: "LIFECYCLE_WRITE",
      stateAfter: "ARCHIVED",
      stateBefore: "ACTIVE",
    },
    organizationId: "organization-1",
    platformScope: false,
    policyVersion: "governance.v1",
    reason: "USER_REQUEST",
    requestId: "request-1",
    resourceId: "curriculum-1",
    resourceType: "CURRICULUM",
    result: "SUCCEEDED",
    source: "DOMAIN_SERVICE",
    ...overrides,
  };
}

class MemoryAuditRepository implements AuditRepository {
  readonly appends: Array<{
    event: AuditEvent;
    expectation: AuditAppendExpectation;
  }> = [];

  constructor(private readonly head: AuditChainHead | null = null) {}

  async getChainHead(): Promise<AuditChainHead | null> {
    return this.head;
  }

  async append(
    event: AuditEvent,
    expectation: AuditAppendExpectation,
  ): Promise<void> {
    this.appends.push({ event, expectation });
  }
}

const sha256HashChain: AuditHashChain = {
  async calculateHash(payload: CanonicalAuditPayload): Promise<string> {
    return createHash("sha256").update(payload).digest("hex");
  },
};

function writer(repository: AuditRepository): AuditWriter {
  return new AuditWriter({
    clock: { now: () => occurredAt },
    hashChain: sha256HashChain,
    idGenerator: { generateEventId: () => eventId },
    repository,
  });
}

describe("AuditWriter", () => {
  it("validates, hashes, appends, and returns a minimal immutable receipt", async () => {
    const repository = new MemoryAuditRepository();

    const receipt = await writer(repository).write(validCommand());

    expect(repository.appends).toHaveLength(1);
    const append = repository.appends[0];
    expect(append?.event.previousHash).toBeNull();
    expect(append?.event.currentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(append?.expectation).toEqual({
      chain: {
        chainId: "organization:organization-1",
        organizationId: "organization-1",
        platformScope: false,
      },
      expectedPreviousHash: null,
    });
    expect(receipt).toEqual({
      chainId: "organization:organization-1",
      correlationId: "correlation-1",
      currentHash: append?.event.currentHash,
      eventId,
      occurredAt,
      version: 1,
    });
    expect(receipt).not.toHaveProperty("actorId");
    expect(receipt).not.toHaveProperty("metadata");
    expect(receipt).not.toHaveProperty("reason");
    expect(Object.isFrozen(receipt)).toBe(true);
    expect(Object.isFrozen(append?.event)).toBe(true);
    expect(Object.isFrozen(append?.event.metadata)).toBe(true);
  });

  it("uses and compare-and-sets the validated previous chain hash", async () => {
    const previousHash = "a".repeat(64) as AuditChainHead["currentHash"];
    const repository = new MemoryAuditRepository({
      chainId: "organization:organization-1",
      currentHash: previousHash,
      eventId: "audit-event-previous",
      occurredAt: "2026-07-22T01:00:00.000Z",
      version: 1,
    });

    await writer(repository).write(validCommand());

    expect(repository.appends[0]?.event.previousHash).toBe(previousHash);
    expect(repository.appends[0]?.expectation.expectedPreviousHash).toBe(
      previousHash,
    );
  });

  it("produces the same hash for the same event material", async () => {
    const firstRepository = new MemoryAuditRepository();
    const secondRepository = new MemoryAuditRepository();

    await writer(firstRepository).write(validCommand());
    await writer(secondRepository).write(validCommand());

    expect(firstRepository.appends[0]?.event.currentHash).toBe(
      secondRepository.appends[0]?.event.currentHash,
    );
  });

  it("fails closed before hashing malformed input", async () => {
    const hashChain: AuditHashChain = {
      calculateHash: vi.fn(async () => "b".repeat(64)),
    };
    const repository = new MemoryAuditRepository();
    const auditWriter = new AuditWriter({
      clock: { now: () => occurredAt },
      hashChain,
      idGenerator: { generateEventId: () => eventId },
      repository,
    });

    await expect(
      auditWriter.write({ ...validCommand(), actorId: "person@example.com" }),
    ).rejects.toMatchObject({ code: "INVALID_AUDIT_ACTOR" });
    expect(hashChain.calculateHash).not.toHaveBeenCalled();
    expect(repository.appends).toHaveLength(0);
  });

  it("does not return a receipt when atomic append fails", async () => {
    const repository: AuditRepository = {
      append: vi.fn(async () => {
        throw new Error("CHAIN_HEAD_CONFLICT");
      }),
      getChainHead: vi.fn(async () => null),
    };

    await expect(writer(repository).write(validCommand())).rejects.toThrow(
      "CHAIN_HEAD_CONFLICT",
    );
  });

  it("rejects a forged repository chain head", async () => {
    const repository = new MemoryAuditRepository({
      chainId: "organization:other-organization",
      currentHash: "c".repeat(64) as AuditChainHead["currentHash"],
      eventId: "audit-event-previous",
      occurredAt: "2026-07-22T01:00:00.000Z",
      version: 1,
    });

    await expect(
      writer(repository).write(validCommand()),
    ).rejects.toMatchObject({ code: "INVALID_AUDIT_CHAIN_HEAD" });
  });

  it("rejects unexpected data returned with a repository chain head", async () => {
    const repository = new MemoryAuditRepository({
      chainId: "organization:organization-1",
      currentHash: "c".repeat(64) as AuditChainHead["currentHash"],
      eventId: "audit-event-previous",
      occurredAt: "2026-07-22T01:00:00.000Z",
      version: 1,
      unexpected: "untrusted-value",
    } as AuditChainHead);

    await expect(
      writer(repository).write(validCommand()),
    ).rejects.toMatchObject({ code: "INVALID_AUDIT_CHAIN_HEAD" });
  });
});
