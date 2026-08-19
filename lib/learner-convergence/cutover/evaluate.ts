import {
  LEARNER_CUTOVER_VERSION,
  type ConsumerCutoverReadinessInput,
  type ConsumerCutoverReadinessResult,
  type LearnerCutoverBlockingReason,
  type LearnerCutoverReadiness,
} from "@/lib/learner-convergence/cutover/domain";

const PREREQUISITES: Readonly<Record<LearnerCutoverBlockingReason, string>> =
  Object.freeze({
    AMBIGUOUS_IDENTITY: "Resolve every ambiguous learner identity explicitly.",
    AUTHORITATIVE_IDENTITY_MISSING:
      "Provide the required authoritative Account-to-Student identity evidence.",
    CANONICAL_PRIMARY_NOT_OBSERVED:
      "Observe canonical-primary operation through the approved rollback window.",
    CANONICAL_READ_UNTESTED:
      "Add consumer-scoped canonical read and tenant-isolation tests.",
    CRITICAL_CANONICAL_ONLY_UNEXPLAINED:
      "Classify or reconcile every critical canonical-only reference.",
    CRITICAL_LEGACY_ONLY_UNEXPLAINED:
      "Classify or reconcile every critical legacy-only reference.",
    CUTOVER_RUNBOOK_NOT_APPROVED:
      "Approve the consumer-specific cutover and rollback runbook.",
    DEPENDENCY_NOT_READY:
      "Advance all declared upstream consumers to CUTOVER_READY or later.",
    DUAL_READ_NOT_VERIFIED:
      "Run stable legacy-primary/canonical-shadow observation for this consumer.",
    DUAL_WRITE_NOT_VERIFIED:
      "Verify the approved transactional write compatibility strategy.",
    FALLBACK_NOT_READY:
      "Define and test a non-destructive authority fallback path.",
    INVALID_EVIDENCE:
      "Provide complete, non-negative, internally consistent readiness evidence.",
    LEAST_PRIVILEGE_SCOPE_UNVERIFIED:
      "Verify the role-specific least-privilege snapshot and runtime scope.",
    LEGACY_FREEZE_NOT_APPROVED:
      "Complete the rollback window, audit review, and explicit legacy-freeze approval.",
    LEGACY_READ_UNTESTED:
      "Retain regression tests for the legacy compatibility read.",
    NO_EVIDENCE_DATA:
      "Create non-production consumer fixtures that exercise both authorities.",
    SHADOW_ERRORS_PRESENT:
      "Reach a stable observation window with zero shadow errors.",
    STATUS_MAPPING_UNRESOLVED:
      "Define a deterministic mapping for every consumed lifecycle status.",
    TENANT_MISMATCH:
      "Resolve all tenant mismatches and re-verify cross-tenant rejection.",
    UNEXPECTED_ORPHAN_REFERENCE:
      "Resolve or explicitly classify every unexpected orphan reference.",
  });

const READY_DEPENDENCY_STATES: readonly LearnerCutoverReadiness[] = [
  "CANONICAL_PRIMARY",
  "CUTOVER_READY",
  "LEGACY_FROZEN",
];

function isNonNegativeInteger(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

function evidenceIsValid(input: ConsumerCutoverReadinessInput): boolean {
  const numericEvidence = [
    input.parity.ambiguous,
    input.parity.canonical_only,
    input.parity.identity_unresolved,
    input.parity.legacy_only,
    input.parity.orphan_reference,
    input.parity.parity_match,
    input.parity.shadow_error_count,
    input.parity.status_mismatch,
    input.parity.tenant_mismatch,
    input.parity.total_canonical_references,
    input.parity.total_legacy_references,
    input.unexplainedCanonicalOnlyCount,
    input.unexplainedLegacyOnlyCount,
  ];
  return (
    numericEvidence.every(isNonNegativeInteger) &&
    Number.isFinite(input.parity.parity_rate) &&
    input.parity.parity_rate >= 0 &&
    input.parity.parity_rate <= 1
  );
}

function collectReasons(
  input: ConsumerCutoverReadinessInput,
): LearnerCutoverBlockingReason[] {
  const reasons: LearnerCutoverBlockingReason[] = [];
  if (!evidenceIsValid(input)) reasons.push("INVALID_EVIDENCE");
  if (input.dataStatus === "NO_DATA") reasons.push("NO_EVIDENCE_DATA");
  if (input.parity.tenant_mismatch > 0) reasons.push("TENANT_MISMATCH");
  if (
    input.parity.ambiguous > 0 ||
    input.identityAvailability === "AMBIGUOUS"
  ) {
    reasons.push("AMBIGUOUS_IDENTITY");
  }
  if (
    (input.identityRequirement === "REQUIRED" ||
      (input.identityRequirement === "CONDITIONAL" &&
        input.parity.identity_unresolved > 0)) &&
    input.identityAvailability !== "AVAILABLE"
  ) {
    reasons.push("AUTHORITATIVE_IDENTITY_MISSING");
  }
  if (input.parity.orphan_reference > 0) {
    reasons.push("UNEXPECTED_ORPHAN_REFERENCE");
  }
  if (input.parity.shadow_error_count > 0) {
    reasons.push("SHADOW_ERRORS_PRESENT");
  }
  if (
    input.statusMapping === "UNRESOLVED" ||
    input.parity.status_mismatch > 0
  ) {
    reasons.push("STATUS_MAPPING_UNRESOLVED");
  }
  if (input.unexplainedLegacyOnlyCount > 0) {
    reasons.push("CRITICAL_LEGACY_ONLY_UNEXPLAINED");
  }
  if (input.unexplainedCanonicalOnlyCount > 0) {
    reasons.push("CRITICAL_CANONICAL_ONLY_UNEXPLAINED");
  }
  if (input.securityStatus !== "READY") {
    reasons.push("LEAST_PRIVILEGE_SCOPE_UNVERIFIED");
  }
  if (
    input.dependencies.some(
      (dependency) => !READY_DEPENDENCY_STATES.includes(dependency.readiness),
    )
  ) {
    reasons.push("DEPENDENCY_NOT_READY");
  }
  if (!input.fallbackReady) reasons.push("FALLBACK_NOT_READY");
  if (!input.legacyReadTested) reasons.push("LEGACY_READ_UNTESTED");
  if (!input.canonicalReadTested) reasons.push("CANONICAL_READ_UNTESTED");
  if (!input.dualReadVerified) reasons.push("DUAL_READ_NOT_VERIFIED");
  if (input.writeStrategy !== "READ_ONLY" && !input.dualWriteVerified) {
    reasons.push("DUAL_WRITE_NOT_VERIFIED");
  }
  if (!input.cutoverRunbookApproved) {
    reasons.push("CUTOVER_RUNBOOK_NOT_APPROVED");
  }
  if (!input.canonicalPrimaryObserved) {
    reasons.push("CANONICAL_PRIMARY_NOT_OBSERVED");
  }
  if (!input.legacyFreezeApproved) {
    reasons.push("LEGACY_FREEZE_NOT_APPROVED");
  }
  return [...new Set(reasons)];
}

function determineState(
  input: ConsumerCutoverReadinessInput,
  reasons: readonly LearnerCutoverBlockingReason[],
): LearnerCutoverReadiness {
  if (reasons.includes("INVALID_EVIDENCE")) return "NOT_READY";
  if (input.dataStatus === "NO_DATA") return "NOT_READY";
  if (
    reasons.includes("AMBIGUOUS_IDENTITY") ||
    reasons.includes("AUTHORITATIVE_IDENTITY_MISSING")
  ) {
    return "BLOCKED_IDENTITY";
  }
  if (
    reasons.includes("TENANT_MISMATCH") ||
    reasons.includes("LEAST_PRIVILEGE_SCOPE_UNVERIFIED")
  ) {
    return "BLOCKED_SECURITY";
  }
  if (reasons.includes("STATUS_MAPPING_UNRESOLVED")) {
    return "BLOCKED_STATUS_MAPPING";
  }
  if (
    reasons.includes("UNEXPECTED_ORPHAN_REFERENCE") ||
    reasons.includes("CRITICAL_LEGACY_ONLY_UNEXPLAINED") ||
    reasons.includes("CRITICAL_CANONICAL_ONLY_UNEXPLAINED")
  ) {
    return "BLOCKED_DATA";
  }
  if (!input.shadowStable || reasons.includes("SHADOW_ERRORS_PRESENT")) {
    return "NOT_READY";
  }
  if (
    reasons.includes("DEPENDENCY_NOT_READY") ||
    reasons.includes("FALLBACK_NOT_READY") ||
    reasons.includes("LEGACY_READ_UNTESTED") ||
    reasons.includes("CANONICAL_READ_UNTESTED")
  ) {
    return "SHADOW_STABLE";
  }
  if (reasons.includes("DUAL_READ_NOT_VERIFIED")) {
    return "DUAL_READ_READY";
  }
  if (
    input.writeStrategy !== "READ_ONLY" &&
    reasons.includes("DUAL_WRITE_NOT_VERIFIED")
  ) {
    return "DUAL_WRITE_READY";
  }
  if (reasons.includes("CUTOVER_RUNBOOK_NOT_APPROVED")) {
    return input.writeStrategy === "READ_ONLY"
      ? "DUAL_READ_READY"
      : "DUAL_WRITE_READY";
  }
  if (reasons.includes("CANONICAL_PRIMARY_NOT_OBSERVED")) {
    return "CUTOVER_READY";
  }
  if (reasons.includes("LEGACY_FREEZE_NOT_APPROVED")) {
    return "CANONICAL_PRIMARY";
  }
  return "LEGACY_FROZEN";
}

export function evaluateConsumerCutoverReadiness(
  input: ConsumerCutoverReadinessInput,
): ConsumerCutoverReadinessResult {
  const reasons = Object.freeze(collectReasons(input));
  return Object.freeze({
    blockingReasons: reasons,
    consumer: input.consumer,
    prerequisites: Object.freeze(
      reasons.map((reason) => PREREQUISITES[reason]),
    ),
    readiness: determineState(input, reasons),
    version: LEARNER_CUTOVER_VERSION,
  });
}
