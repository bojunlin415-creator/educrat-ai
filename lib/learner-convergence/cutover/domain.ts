import type { LearnerShadowSummary } from "@/lib/learner-convergence/shadow/domain";

export const LEARNER_CUTOVER_VERSION = "le-001.cutover.v1" as const;

export const LEARNER_CUTOVER_CONSUMERS = [
  "class_read_detail",
  "teacher_dashboard",
  "reporting",
  "assignment_class_expansion",
  "assignment_recipients",
  "submission_self_resolution",
  "learning_events",
  "mastery_subject_projections",
  "adaptive_recommendations",
  "guardian_verification",
  "parent_portal",
] as const;

export type LearnerCutoverConsumer = (typeof LEARNER_CUTOVER_CONSUMERS)[number];

export const LEARNER_CUTOVER_READINESS_STATES = [
  "NOT_READY",
  "BLOCKED_IDENTITY",
  "BLOCKED_DATA",
  "BLOCKED_SECURITY",
  "BLOCKED_STATUS_MAPPING",
  "SHADOW_STABLE",
  "DUAL_READ_READY",
  "DUAL_WRITE_READY",
  "CUTOVER_READY",
  "CANONICAL_PRIMARY",
  "LEGACY_FROZEN",
] as const;

export type LearnerCutoverReadiness =
  (typeof LEARNER_CUTOVER_READINESS_STATES)[number];

export const LEARNER_CUTOVER_BLOCKING_REASONS = [
  "INVALID_EVIDENCE",
  "NO_EVIDENCE_DATA",
  "TENANT_MISMATCH",
  "AMBIGUOUS_IDENTITY",
  "AUTHORITATIVE_IDENTITY_MISSING",
  "UNEXPECTED_ORPHAN_REFERENCE",
  "SHADOW_ERRORS_PRESENT",
  "STATUS_MAPPING_UNRESOLVED",
  "CRITICAL_LEGACY_ONLY_UNEXPLAINED",
  "CRITICAL_CANONICAL_ONLY_UNEXPLAINED",
  "LEAST_PRIVILEGE_SCOPE_UNVERIFIED",
  "DEPENDENCY_NOT_READY",
  "FALLBACK_NOT_READY",
  "LEGACY_READ_UNTESTED",
  "CANONICAL_READ_UNTESTED",
  "DUAL_READ_NOT_VERIFIED",
  "DUAL_WRITE_NOT_VERIFIED",
  "CUTOVER_RUNBOOK_NOT_APPROVED",
  "CANONICAL_PRIMARY_NOT_OBSERVED",
  "LEGACY_FREEZE_NOT_APPROVED",
] as const;

export type LearnerCutoverBlockingReason =
  (typeof LEARNER_CUTOVER_BLOCKING_REASONS)[number];

export type LearnerIdentityRequirement =
  "CONDITIONAL" | "NOT_REQUIRED" | "REQUIRED";

export type LearnerIdentityAvailability =
  "AMBIGUOUS" | "AVAILABLE" | "MISSING" | "NOT_APPLICABLE";

export type CutoverSecurityStatus = "BLOCKED" | "READY" | "UNVERIFIED";
export type CutoverStatusMapping = "DETERMINISTIC" | "UNRESOLVED";
export type CutoverWriteStrategy =
  | "CANONICAL_WRITE_COMPATIBILITY_PROJECTION"
  | "DUAL_REFERENCE_WRITE"
  | "READ_ONLY"
  | "REBUILDABLE_PROJECTION";

export interface LearnerCutoverDependencyEvidence {
  readonly consumer: LearnerCutoverConsumer;
  readonly readiness: LearnerCutoverReadiness;
}

export interface ConsumerCutoverReadinessInput {
  readonly canonicalPrimaryObserved: boolean;
  readonly canonicalReadTested: boolean;
  readonly consumer: LearnerCutoverConsumer;
  readonly cutoverRunbookApproved: boolean;
  readonly dataStatus: "HAS_DATA" | "NO_DATA";
  readonly dependencies: readonly LearnerCutoverDependencyEvidence[];
  readonly dualReadVerified: boolean;
  readonly dualWriteVerified: boolean;
  readonly fallbackReady: boolean;
  readonly identityAvailability: LearnerIdentityAvailability;
  readonly identityRequirement: LearnerIdentityRequirement;
  readonly legacyFreezeApproved: boolean;
  readonly legacyReadTested: boolean;
  readonly parity: Readonly<LearnerShadowSummary>;
  readonly securityStatus: CutoverSecurityStatus;
  readonly shadowStable: boolean;
  readonly statusMapping: CutoverStatusMapping;
  readonly unexplainedCanonicalOnlyCount: number;
  readonly unexplainedLegacyOnlyCount: number;
  readonly writeStrategy: CutoverWriteStrategy;
}

export interface ConsumerCutoverReadinessResult {
  readonly blockingReasons: readonly LearnerCutoverBlockingReason[];
  readonly consumer: LearnerCutoverConsumer;
  readonly prerequisites: readonly string[];
  readonly readiness: LearnerCutoverReadiness;
  readonly version: typeof LEARNER_CUTOVER_VERSION;
}

export type AccountlessLearnerBehavior =
  | "INCLUDED_BY_CANONICAL_STUDENT"
  | "NOT_APPLICABLE"
  | "REQUIRES_EXPLICIT_LOGIN_MECHANISM"
  | "SUPPORTED_WHEN_EVIDENCE_IS_CANONICAL";

export interface ConsumerCutoverPlan {
  readonly accountLinkRequirement: LearnerIdentityRequirement;
  readonly consumer: LearnerCutoverConsumer;
  readonly controlKey: LearnerCutoverControlKey;
  readonly dependencies: readonly LearnerCutoverConsumer[];
  readonly externalPrerequisites: readonly string[];
  readonly managedAccountlessBehavior: AccountlessLearnerBehavior;
  readonly packageId: LearnerCutoverPackageId;
  readonly wave: 1 | 2 | 3 | 4 | 5;
  readonly writeStrategy: CutoverWriteStrategy;
}

export const LEARNER_CUTOVER_CONTROL_KEYS = [
  "learner_class_roster_canonical_read",
  "learner_teacher_dashboard_canonical_population",
  "learner_reporting_canonical_population",
  "learner_assignment_canonical_expansion",
  "learner_assignment_recipient_canonical_reference",
  "learner_submission_canonical_self",
  "learner_learning_event_canonical_reference",
  "learner_mastery_canonical_projection",
  "learner_adaptive_canonical_consumer",
  "learner_guardian_canonical_child",
  "learner_parent_portal_canonical_child",
] as const;

export type LearnerCutoverControlKey =
  (typeof LEARNER_CUTOVER_CONTROL_KEYS)[number];

export const LEARNER_CUTOVER_CONTROL_MODES = [
  "LEGACY_ONLY",
  "LEGACY_PRIMARY_CANONICAL_SHADOW",
  "CANONICAL_PRIMARY_LEGACY_FALLBACK",
  "CANONICAL_ONLY",
] as const;

export type LearnerCutoverControlMode =
  (typeof LEARNER_CUTOVER_CONTROL_MODES)[number];

export interface LearnerCutoverControlDefinition {
  readonly defaultMode: "LEGACY_ONLY";
  readonly key: LearnerCutoverControlKey;
  readonly modes: readonly LearnerCutoverControlMode[];
  readonly ownerPackage: LearnerCutoverPackageId;
}

export const LEARNER_CUTOVER_PACKAGE_IDS = [
  "LE-001-5A",
  "LE-001-5B",
  "LE-001-5C",
  "LE-001-5D",
  "LE-001-5E",
  "LE-001-5F",
  "LE-001-5G",
  "LE-001-5H",
  "LE-001-5I",
  "LE-001-5J",
] as const;

export type LearnerCutoverPackageId =
  (typeof LEARNER_CUTOVER_PACKAGE_IDS)[number];

export interface LearnerCutoverPackagePlan {
  readonly consumers: readonly LearnerCutoverConsumer[];
  readonly dependsOn: readonly LearnerCutoverPackageId[];
  readonly id: LearnerCutoverPackageId;
  readonly title: string;
}

export const TEACHER_DASHBOARD_POPULATIONS = [
  "class_learner_population",
  "assignment_population",
  "submission_population",
  "analytics_population",
  "reporting_population",
  "alerts_recommendations_population",
] as const;

export type TeacherDashboardPopulation =
  (typeof TEACHER_DASHBOARD_POPULATIONS)[number];

export interface TeacherDashboardPopulationPlan {
  readonly canonicalDependency: LearnerCutoverConsumer;
  readonly independentlySwitchable: true;
  readonly population: TeacherDashboardPopulation;
}
