import type { AuditMetadata } from "@/lib/audit/domain/metadata";
import type {
  AuditHash,
  AuditIdentifier,
  AuditTimestamp,
} from "@/lib/audit/shared/references";

export const AUDIT_EVENT_VERSION = 1 as const;
export type AuditEventVersion = typeof AUDIT_EVENT_VERSION;

export const AUDIT_ACTOR_TYPES = [
  "ACCOUNT",
  "PERSON",
  "SERVICE_PRINCIPAL",
  "SYSTEM",
  "PLATFORM_ACTOR",
  "TOMBSTONE",
] as const;
export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export const AUDIT_RESULTS = ["SUCCEEDED", "DENIED", "FAILED"] as const;
export type AuditResult = (typeof AUDIT_RESULTS)[number];

export interface AuditWriteCommand {
  readonly action: string;
  readonly actingRole?: string;
  readonly actorId: AuditIdentifier;
  readonly actorType: AuditActorType;
  readonly correlationId: AuditIdentifier;
  readonly metadata: AuditMetadata;
  readonly organizationId: AuditIdentifier | null;
  readonly platformScope: boolean;
  readonly policyVersion?: string;
  readonly reason: string;
  readonly requestId: AuditIdentifier;
  readonly resourceId: AuditIdentifier;
  readonly resourceType: string;
  readonly result: AuditResult;
  readonly source: string;
}

export interface AuditEvent extends AuditWriteCommand {
  readonly currentHash: AuditHash;
  readonly eventId: AuditIdentifier;
  readonly occurredAt: AuditTimestamp;
  readonly previousHash: AuditHash | null;
  readonly version: AuditEventVersion;
}

export type AuditEventHashMaterial = Omit<AuditEvent, "currentHash">;

export interface AuditChainReference {
  readonly chainId: AuditIdentifier;
  readonly organizationId: AuditIdentifier | null;
  readonly platformScope: boolean;
}

export interface AuditChainHead {
  readonly chainId: AuditIdentifier;
  readonly currentHash: AuditHash;
  readonly eventId: AuditIdentifier;
  readonly occurredAt: AuditTimestamp;
  readonly version: AuditEventVersion;
}
