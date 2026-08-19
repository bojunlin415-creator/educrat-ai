import {
  type ConsumerCutoverPlan,
  type LearnerCutoverConsumer,
  type TeacherDashboardPopulation,
  type TeacherDashboardPopulationPlan,
} from "@/lib/learner-convergence/cutover/domain";
import { LEARNER_CUTOVER_DEPENDENCY_GRAPH } from "@/lib/learner-convergence/cutover/dependency-graph";

function plan(
  value: Omit<ConsumerCutoverPlan, "dependencies">,
): ConsumerCutoverPlan {
  return Object.freeze({
    ...value,
    dependencies: LEARNER_CUTOVER_DEPENDENCY_GRAPH[value.consumer],
    externalPrerequisites: Object.freeze([...value.externalPrerequisites]),
  });
}

export const LEARNER_CONSUMER_CUTOVER_PLANS: Readonly<
  Record<LearnerCutoverConsumer, ConsumerCutoverPlan>
> = Object.freeze({
  adaptive_recommendations: plan({
    accountLinkRequirement: "NOT_REQUIRED",
    consumer: "adaptive_recommendations",
    controlKey: "learner_adaptive_canonical_consumer",
    externalPrerequisites: [
      "canonical-safe learning evidence",
      "canonical mastery projection",
      "assignment and submission ownership parity",
    ],
    managedAccountlessBehavior: "SUPPORTED_WHEN_EVIDENCE_IS_CANONICAL",
    packageId: "LE-001-5I",
    wave: 4,
    writeStrategy: "CANONICAL_WRITE_COMPATIBILITY_PROJECTION",
  }),
  assignment_class_expansion: plan({
    accountLinkRequirement: "NOT_REQUIRED",
    consumer: "assignment_class_expansion",
    controlKey: "learner_assignment_canonical_expansion",
    externalPrerequisites: [
      "active-class and active-membership lifecycle mapping",
      "duplicate-safe canonical recipient expansion",
      "tenant-scoped class relationship adapter",
    ],
    managedAccountlessBehavior: "INCLUDED_BY_CANONICAL_STUDENT",
    packageId: "LE-001-5D",
    wave: 2,
    writeStrategy: "CANONICAL_WRITE_COMPATIBILITY_PROJECTION",
  }),
  assignment_recipients: plan({
    accountLinkRequirement: "CONDITIONAL",
    consumer: "assignment_recipients",
    controlKey: "learner_assignment_recipient_canonical_reference",
    externalPrerequisites: [
      "dual-reference compatibility schema",
      "recipient idempotency and uniqueness",
      "canonical recipient audit correlation",
    ],
    managedAccountlessBehavior: "INCLUDED_BY_CANONICAL_STUDENT",
    packageId: "LE-001-5E",
    wave: 2,
    writeStrategy: "DUAL_REFERENCE_WRITE",
  }),
  class_read_detail: plan({
    accountLinkRequirement: "NOT_REQUIRED",
    consumer: "class_read_detail",
    controlKey: "learner_class_roster_canonical_read",
    externalPrerequisites: [
      "teacher assigned-class least-privilege projection",
      "active and left enrollment fixtures",
      "legacy-only fallback and empty-state tests",
    ],
    managedAccountlessBehavior: "INCLUDED_BY_CANONICAL_STUDENT",
    packageId: "LE-001-5A",
    wave: 1,
    writeStrategy: "READ_ONLY",
  }),
  guardian_verification: plan({
    accountLinkRequirement: "NOT_REQUIRED",
    consumer: "guardian_verification",
    controlKey: "learner_guardian_canonical_child",
    externalPrerequisites: [
      "verified guardian-child relationship",
      "canonical Student relationship reference",
      "revocation and wrong-child negative tests",
    ],
    managedAccountlessBehavior: "INCLUDED_BY_CANONICAL_STUDENT",
    packageId: "LE-001-5J",
    wave: 5,
    writeStrategy: "DUAL_REFERENCE_WRITE",
  }),
  learning_events: plan({
    accountLinkRequirement: "CONDITIONAL",
    consumer: "learning_events",
    controlKey: "learner_learning_event_canonical_reference",
    externalPrerequisites: [
      "zero-loss legacy learner reference preservation",
      "canonical learner reference for new events",
      "historical compatibility resolver",
    ],
    managedAccountlessBehavior: "SUPPORTED_WHEN_EVIDENCE_IS_CANONICAL",
    packageId: "LE-001-5G",
    wave: 4,
    writeStrategy: "CANONICAL_WRITE_COMPATIBILITY_PROJECTION",
  }),
  mastery_subject_projections: plan({
    accountLinkRequirement: "NOT_REQUIRED",
    consumer: "mastery_subject_projections",
    controlKey: "learner_mastery_canonical_projection",
    externalPrerequisites: [
      "canonical-safe event source",
      "deterministic rebuild and result parity",
      "projection rollback by authority switch",
    ],
    managedAccountlessBehavior: "SUPPORTED_WHEN_EVIDENCE_IS_CANONICAL",
    packageId: "LE-001-5H",
    wave: 4,
    writeStrategy: "REBUILDABLE_PROJECTION",
  }),
  parent_portal: plan({
    accountLinkRequirement: "NOT_REQUIRED",
    consumer: "parent_portal",
    controlKey: "learner_parent_portal_canonical_child",
    externalPrerequisites: [
      "active verified guardian-child relationship",
      "guardian-scoped canonical child projection",
      "immediate revocation and cross-tenant rejection",
    ],
    managedAccountlessBehavior: "INCLUDED_BY_CANONICAL_STUDENT",
    packageId: "LE-001-5J",
    wave: 5,
    writeStrategy: "READ_ONLY",
  }),
  reporting: plan({
    accountLinkRequirement: "CONDITIONAL",
    consumer: "reporting",
    controlKey: "learner_reporting_canonical_population",
    externalPrerequisites: [
      "canonical Student report key",
      "legacy Profile compatibility key",
      "historical and rebuildable projection classification",
    ],
    managedAccountlessBehavior: "SUPPORTED_WHEN_EVIDENCE_IS_CANONICAL",
    packageId: "LE-001-5C",
    wave: 1,
    writeStrategy: "READ_ONLY",
  }),
  submission_self_resolution: plan({
    accountLinkRequirement: "REQUIRED",
    consumer: "submission_self_resolution",
    controlKey: "learner_submission_canonical_self",
    externalPrerequisites: [
      "one effective verified Account-to-Student link per organization",
      "canonical assignment recipient match",
      "legacy/canonical self mismatch denial",
    ],
    managedAccountlessBehavior: "REQUIRES_EXPLICIT_LOGIN_MECHANISM",
    packageId: "LE-001-5F",
    wave: 3,
    writeStrategy: "DUAL_REFERENCE_WRITE",
  }),
  teacher_dashboard: plan({
    accountLinkRequirement: "CONDITIONAL",
    consumer: "teacher_dashboard",
    controlKey: "learner_teacher_dashboard_canonical_population",
    externalPrerequisites: [
      "independent sub-population controls",
      "teacher assigned-class least-privilege projection",
      "upstream assignment/reporting/analytics readiness",
    ],
    managedAccountlessBehavior: "SUPPORTED_WHEN_EVIDENCE_IS_CANONICAL",
    packageId: "LE-001-5B",
    wave: 1,
    writeStrategy: "READ_ONLY",
  }),
});

export const TEACHER_DASHBOARD_POPULATION_PLANS: Readonly<
  Record<TeacherDashboardPopulation, TeacherDashboardPopulationPlan>
> = Object.freeze({
  alerts_recommendations_population: Object.freeze({
    canonicalDependency: "adaptive_recommendations",
    independentlySwitchable: true,
    population: "alerts_recommendations_population",
  }),
  analytics_population: Object.freeze({
    canonicalDependency: "mastery_subject_projections",
    independentlySwitchable: true,
    population: "analytics_population",
  }),
  assignment_population: Object.freeze({
    canonicalDependency: "assignment_recipients",
    independentlySwitchable: true,
    population: "assignment_population",
  }),
  class_learner_population: Object.freeze({
    canonicalDependency: "class_read_detail",
    independentlySwitchable: true,
    population: "class_learner_population",
  }),
  reporting_population: Object.freeze({
    canonicalDependency: "reporting",
    independentlySwitchable: true,
    population: "reporting_population",
  }),
  submission_population: Object.freeze({
    canonicalDependency: "submission_self_resolution",
    independentlySwitchable: true,
    population: "submission_population",
  }),
});
