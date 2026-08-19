import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";

export const LEARNER_SHADOW_VERSION = "le-001.shadow.v1" as const;

export const LEARNER_SHADOW_CONSUMERS = [
  "class_read_detail",
  "teacher_dashboard",
  "assignment_class_expansion",
  "assignment_recipients",
  "submission_self_resolution",
  "learning_events",
  "mastery_subject_projections",
  "adaptive_recommendations",
  "reporting",
  "guardian_parent_portal",
] as const;

export type LearnerShadowConsumer = (typeof LEARNER_SHADOW_CONSUMERS)[number];

export const LEARNER_SHADOW_PARITY_STATES = [
  "PARITY_MATCH",
  "LEGACY_ONLY",
  "CANONICAL_ONLY",
  "IDENTITY_UNRESOLVED",
  "AMBIGUOUS_IDENTITY",
  "TENANT_MISMATCH",
  "STATUS_MISMATCH",
  "MISSING_REFERENCE",
  "UNSUPPORTED_LEGACY_STATE",
  "ORPHAN_REFERENCE",
] as const;

export type LearnerShadowParityState =
  (typeof LEARNER_SHADOW_PARITY_STATES)[number];

export type LearnerShadowReadiness =
  | "BLOCKED_DATA"
  | "BLOCKED_IDENTITY"
  | "BLOCKED_SECURITY"
  | "NOT_READY"
  | "PARITY_READY"
  | "SHADOW_STABLE";

export interface LearnerShadowDiscrepancy {
  readonly canonicalReference: string | null;
  readonly consumer: LearnerShadowConsumer;
  readonly legacyReference: string | null;
  readonly parityState: Exclude<LearnerShadowParityState, "PARITY_MATCH">;
  readonly reasonCode: string;
}

export interface LearnerShadowSummary {
  readonly ambiguous: number;
  readonly canonical_only: number;
  readonly identity_unresolved: number;
  readonly legacy_only: number;
  readonly orphan_reference: number;
  readonly parity_match: number;
  readonly parity_rate: number;
  readonly shadow_error_count: number;
  readonly status_mismatch: number;
  readonly tenant_mismatch: number;
  readonly total_canonical_references: number;
  readonly total_legacy_references: number;
}

export interface LearnerShadowConsumerResult {
  readonly consumer: LearnerShadowConsumer;
  readonly dataStatus: "HAS_DATA" | "NO_DATA";
  readonly discrepancies: readonly LearnerShadowDiscrepancy[];
  readonly organizationId: string;
  readonly readiness: LearnerShadowReadiness;
  readonly summary: Readonly<LearnerShadowSummary>;
  readonly version: typeof LEARNER_SHADOW_VERSION;
}

export interface LearnerShadowScope {
  readonly assignmentIds?: readonly string[];
  readonly classIds?: readonly string[];
  readonly legacyAccountIds?: readonly string[];
}

export interface LearnerShadowConsumerCheckInput {
  readonly consumer: LearnerShadowConsumer;
  readonly scope?: LearnerShadowScope;
  readonly snapshot: LearnerParitySnapshot;
}

export interface LearnerShadowSuiteInput {
  readonly adaptiveLegacyAccountIds?: readonly string[];
  readonly assignmentClassIds?: readonly string[];
  readonly snapshot: LearnerParitySnapshot;
}

export interface LearnerShadowObservation {
  readonly outcome: "COMPLETED" | "DISABLED" | "FAILED";
  readonly result: LearnerShadowConsumerResult | null;
}
