import type { CanonicalAuditPayload } from "@/lib/audit/shared/references";

export interface AuditHashChain {
  calculateHash(payload: CanonicalAuditPayload): Promise<unknown>;
}
