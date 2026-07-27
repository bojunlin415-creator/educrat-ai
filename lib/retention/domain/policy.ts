import type { RetentionDefinition } from "@/lib/retention/domain/definition";
import type { LegalHoldReference } from "@/lib/retention/domain/legal-hold";
import type { RetentionCheckRequest } from "@/lib/retention/domain/request";

export interface RetentionPolicyEvaluation {
  readonly definition: RetentionDefinition;
  readonly legalHolds: readonly LegalHoldReference[];
  readonly request: RetentionCheckRequest;
}

export type RetentionPolicyResult =
  | Readonly<{ readonly decision: "ALLOW" }>
  | Readonly<{
      readonly decision: "DENY";
      readonly reason: "RETENTION_POLICY_DENIED";
    }>;
