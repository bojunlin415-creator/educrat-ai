import type { RetentionContractVersion } from "@/lib/retention/domain/definition";
import type {
  LegalHoldId,
  LegalHoldReason,
  RetentionResourceId,
  RetentionResourceType,
} from "@/lib/retention/shared/references";

export interface LegalHoldReference {
  readonly active: boolean;
  readonly holdId: LegalHoldId;
  readonly holdReason: LegalHoldReason;
  readonly resourceId: RetentionResourceId;
  readonly resourceType: RetentionResourceType;
  readonly version: RetentionContractVersion;
}
