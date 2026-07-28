import type { RecycleEntry } from "@/lib/recycle-bin/domain/entry";
import type {
  PermanentDeletionRequest,
  RestoreRequest,
} from "@/lib/recycle-bin/domain/request";

export const RECYCLE_BIN_POLICY_DENIAL_REASONS = [
  "RECYCLE_BIN_POLICY_DENIED",
] as const;

export type RecycleBinPolicyDenialReason =
  (typeof RECYCLE_BIN_POLICY_DENIAL_REASONS)[number];

export type RecycleBinPolicyResult =
  | { readonly decision: "ALLOW" }
  | {
      readonly decision: "DENY";
      readonly reason: RecycleBinPolicyDenialReason;
    };

export interface RestorePolicyInput {
  readonly entry: RecycleEntry;
  readonly request: RestoreRequest;
}

export interface PermanentDeletionPolicyInput {
  readonly entry: RecycleEntry;
  readonly request: PermanentDeletionRequest;
}

export interface RecycleBinPolicy {
  evaluatePermanentDeletion(
    input: PermanentDeletionPolicyInput,
  ): RecycleBinPolicyResult;
  evaluateRestore(input: RestorePolicyInput): RecycleBinPolicyResult;
}
