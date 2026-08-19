import { LEARNER_CUTOVER_CONSUMERS } from "@/lib/learner-convergence/cutover/domain";
import type {
  ConsumerCutoverReadinessInput,
  ConsumerCutoverReadinessResult,
  CutoverSecurityStatus,
  LearnerCutoverConsumer,
  LearnerIdentityAvailability,
} from "@/lib/learner-convergence/cutover/domain";
import { LEARNER_CUTOVER_DEPENDENCY_GRAPH } from "@/lib/learner-convergence/cutover/dependency-graph";
import { evaluateConsumerCutoverReadiness } from "@/lib/learner-convergence/cutover/evaluate";
import { LEARNER_CONSUMER_CUTOVER_PLANS } from "@/lib/learner-convergence/cutover/plan";
import type {
  LearnerShadowConsumer,
  LearnerShadowConsumerResult,
} from "@/lib/learner-convergence/shadow/domain";

const SHADOW_CONSUMER_BY_CUTOVER_CONSUMER: Readonly<
  Record<LearnerCutoverConsumer, LearnerShadowConsumer>
> = Object.freeze({
  adaptive_recommendations: "adaptive_recommendations",
  assignment_class_expansion: "assignment_class_expansion",
  assignment_recipients: "assignment_recipients",
  class_read_detail: "class_read_detail",
  guardian_verification: "guardian_parent_portal",
  learning_events: "learning_events",
  mastery_subject_projections: "mastery_subject_projections",
  parent_portal: "guardian_parent_portal",
  reporting: "reporting",
  submission_self_resolution: "submission_self_resolution",
  teacher_dashboard: "teacher_dashboard",
});

function securityStatus(
  consumer: LearnerCutoverConsumer,
): CutoverSecurityStatus {
  if (
    consumer === "class_read_detail" ||
    consumer === "teacher_dashboard" ||
    consumer === "reporting"
  ) {
    return "BLOCKED";
  }
  return "UNVERIFIED";
}

function identityAvailability(
  consumer: LearnerCutoverConsumer,
  result: LearnerShadowConsumerResult,
): LearnerIdentityAvailability {
  const requirement =
    LEARNER_CONSUMER_CUTOVER_PLANS[consumer].accountLinkRequirement;
  if (requirement === "NOT_REQUIRED") return "NOT_APPLICABLE";
  if (result.summary.ambiguous > 0) return "AMBIGUOUS";
  if (
    result.summary.identity_unresolved > 0 ||
    result.summary.parity_match === 0
  ) {
    return "MISSING";
  }
  return "AVAILABLE";
}

export function evaluatePhase4DevelopmentReadiness(
  phase4Results: readonly LearnerShadowConsumerResult[],
): readonly ConsumerCutoverReadinessResult[] {
  const shadowByConsumer = new Map(
    phase4Results.map((result) => [result.consumer, result]),
  );
  return Object.freeze(
    LEARNER_CUTOVER_CONSUMERS.map((consumer) => {
      const shadowConsumer = SHADOW_CONSUMER_BY_CUTOVER_CONSUMER[consumer];
      const shadow = shadowByConsumer.get(shadowConsumer);
      if (!shadow) {
        throw new Error(`phase4_evidence_missing:${shadowConsumer}`);
      }
      const plan = LEARNER_CONSUMER_CUTOVER_PLANS[consumer];
      const input: ConsumerCutoverReadinessInput = {
        canonicalPrimaryObserved: false,
        canonicalReadTested: false,
        consumer,
        cutoverRunbookApproved: false,
        dataStatus: shadow.dataStatus,
        dependencies: LEARNER_CUTOVER_DEPENDENCY_GRAPH[consumer].map(
          (dependency) =>
            Object.freeze({
              consumer: dependency,
              readiness: "NOT_READY" as const,
            }),
        ),
        dualReadVerified: false,
        dualWriteVerified: false,
        fallbackReady: false,
        identityAvailability: identityAvailability(consumer, shadow),
        identityRequirement: plan.accountLinkRequirement,
        legacyFreezeApproved: false,
        legacyReadTested: true,
        parity: shadow.summary,
        securityStatus: securityStatus(consumer),
        shadowStable: shadow.summary.shadow_error_count === 0,
        statusMapping:
          shadow.summary.status_mismatch === 0 ? "DETERMINISTIC" : "UNRESOLVED",
        unexplainedCanonicalOnlyCount: shadow.summary.canonical_only,
        unexplainedLegacyOnlyCount: shadow.summary.legacy_only,
        writeStrategy: plan.writeStrategy,
      };
      return evaluateConsumerCutoverReadiness(input);
    }),
  );
}
