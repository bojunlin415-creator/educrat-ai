import type {
  AuditChainHead,
  AuditChainReference,
  AuditEvent,
} from "@/lib/audit/domain/audit-event";
import type { AuditHash } from "@/lib/audit/shared/references";

export interface AuditAppendExpectation {
  readonly chain: AuditChainReference;
  readonly expectedPreviousHash: AuditHash | null;
}

export interface AuditRepository {
  getChainHead(chain: AuditChainReference): Promise<AuditChainHead | null>;

  append(event: AuditEvent, expectation: AuditAppendExpectation): Promise<void>;
}
