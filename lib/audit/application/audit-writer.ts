import {
  AUDIT_EVENT_VERSION,
  type AuditEventHashMaterial,
  type AuditWriteCommand,
} from "@/lib/audit/domain/audit-event";
import {
  createAuditReceipt,
  type AuditReceipt,
} from "@/lib/audit/domain/audit-receipt";
import { serializeAuditEventForHash } from "@/lib/audit/domain/serialization";
import {
  createAuditChainReference,
  createImmutableAuditEvent,
  validateAuditChainHead,
  validateAuditEventId,
  validateAuditHash,
  validateAuditTimestamp,
  validateAuditWriteCommand,
} from "@/lib/audit/domain/validation";
import type { AuditClock } from "@/lib/audit/interfaces/audit-clock";
import type { AuditHashChain } from "@/lib/audit/interfaces/audit-hash-chain";
import type { AuditIdGenerator } from "@/lib/audit/interfaces/audit-id-generator";
import type { AuditRepository } from "@/lib/audit/interfaces/audit-repository";

export interface AuditWriterDependencies {
  readonly clock: AuditClock;
  readonly hashChain: AuditHashChain;
  readonly idGenerator: AuditIdGenerator;
  readonly repository: AuditRepository;
}

export class AuditWriter {
  readonly #clock: AuditClock;
  readonly #hashChain: AuditHashChain;
  readonly #idGenerator: AuditIdGenerator;
  readonly #repository: AuditRepository;

  constructor(dependencies: AuditWriterDependencies) {
    this.#clock = dependencies.clock;
    this.#hashChain = dependencies.hashChain;
    this.#idGenerator = dependencies.idGenerator;
    this.#repository = dependencies.repository;
  }

  async write(input: unknown): Promise<AuditReceipt> {
    const command = validateAuditWriteCommand(input);
    const chain = createAuditChainReference(command);
    const storedHead = await this.#repository.getChainHead(chain);
    const head =
      storedHead === null ? null : validateAuditChainHead(storedHead, chain);
    const eventId = validateAuditEventId(this.#idGenerator.generateEventId());
    const occurredAt = validateAuditTimestamp(this.#clock.now());
    const previousHash = head?.currentHash ?? null;
    const hashMaterial = this.#createHashMaterial(
      command,
      eventId,
      occurredAt,
      previousHash,
    );
    const currentHash = validateAuditHash(
      await this.#hashChain.calculateHash(
        serializeAuditEventForHash(hashMaterial),
      ),
    );
    const event = createImmutableAuditEvent({
      ...hashMaterial,
      currentHash,
    });

    await this.#repository.append(event, {
      chain,
      expectedPreviousHash: previousHash,
    });

    return createAuditReceipt(event, chain);
  }

  #createHashMaterial(
    command: AuditWriteCommand,
    eventId: ReturnType<typeof validateAuditEventId>,
    occurredAt: ReturnType<typeof validateAuditTimestamp>,
    previousHash: ReturnType<typeof validateAuditHash> | null,
  ): AuditEventHashMaterial {
    return Object.freeze({
      ...command,
      eventId,
      occurredAt,
      previousHash,
      version: AUDIT_EVENT_VERSION,
    });
  }
}
