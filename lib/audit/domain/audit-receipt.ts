import type {
  AuditChainReference,
  AuditEvent,
  AuditEventVersion,
} from "@/lib/audit/domain/audit-event";
import type {
  AuditHash,
  AuditIdentifier,
  AuditTimestamp,
} from "@/lib/audit/shared/references";

export interface AuditReceipt {
  readonly chainId: AuditIdentifier;
  readonly correlationId: AuditIdentifier;
  readonly currentHash: AuditHash;
  readonly eventId: AuditIdentifier;
  readonly occurredAt: AuditTimestamp;
  readonly version: AuditEventVersion;
}

export function createAuditReceipt(
  event: AuditEvent,
  chain: AuditChainReference,
): AuditReceipt {
  return Object.freeze({
    chainId: chain.chainId,
    correlationId: event.correlationId,
    currentHash: event.currentHash,
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    version: event.version,
  });
}
