import type { RetentionContractVersion } from "@/lib/retention/domain/definition";
import type {
  RetentionResourceId,
  RetentionResourceType,
  RetentionTransition,
} from "@/lib/retention/shared/references";

export interface RetentionCheckRequest {
  readonly requestedTransition: RetentionTransition;
  readonly resourceId: RetentionResourceId;
  readonly resourceType: RetentionResourceType;
  readonly version: RetentionContractVersion;
}
