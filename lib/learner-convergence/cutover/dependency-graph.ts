import {
  LEARNER_CUTOVER_CONSUMERS,
  LEARNER_CUTOVER_PACKAGE_IDS,
  type LearnerCutoverConsumer,
  type LearnerCutoverPackageId,
  type LearnerCutoverPackagePlan,
} from "@/lib/learner-convergence/cutover/domain";

function dependencies(
  ...values: LearnerCutoverConsumer[]
): readonly LearnerCutoverConsumer[] {
  return Object.freeze(values);
}

function packagePlan(
  value: LearnerCutoverPackagePlan,
): LearnerCutoverPackagePlan {
  return Object.freeze({
    ...value,
    consumers: Object.freeze([...value.consumers]),
    dependsOn: Object.freeze([...value.dependsOn]),
  });
}

export const LEARNER_CUTOVER_DEPENDENCY_GRAPH: Readonly<
  Record<LearnerCutoverConsumer, readonly LearnerCutoverConsumer[]>
> = Object.freeze({
  adaptive_recommendations: dependencies(
    "learning_events",
    "mastery_subject_projections",
  ),
  assignment_class_expansion: dependencies("class_read_detail"),
  assignment_recipients: dependencies("assignment_class_expansion"),
  class_read_detail: dependencies(),
  guardian_verification: dependencies(),
  learning_events: dependencies("assignment_recipients"),
  mastery_subject_projections: dependencies("learning_events"),
  parent_portal: dependencies(
    "guardian_verification",
    "reporting",
    "adaptive_recommendations",
  ),
  reporting: dependencies(
    "class_read_detail",
    "assignment_recipients",
    "learning_events",
  ),
  submission_self_resolution: dependencies("assignment_recipients"),
  teacher_dashboard: dependencies(
    "class_read_detail",
    "assignment_recipients",
    "submission_self_resolution",
    "mastery_subject_projections",
    "adaptive_recommendations",
    "reporting",
  ),
});

export const LEARNER_CUTOVER_PACKAGES: readonly LearnerCutoverPackagePlan[] =
  Object.freeze([
    packagePlan({
      consumers: ["class_read_detail"],
      dependsOn: [],
      id: "LE-001-5A",
      title: "Class Roster Canonical Read Cutover",
    }),
    packagePlan({
      consumers: ["teacher_dashboard"],
      dependsOn: ["LE-001-5A"],
      id: "LE-001-5B",
      title: "Teacher Dashboard Class Learner Population Cutover",
    }),
    packagePlan({
      consumers: ["reporting"],
      dependsOn: ["LE-001-5A"],
      id: "LE-001-5C",
      title: "Reporting Learner Population Compatibility Cutover",
    }),
    packagePlan({
      consumers: ["assignment_class_expansion"],
      dependsOn: ["LE-001-5A"],
      id: "LE-001-5D",
      title: "Assignment Class Expansion Cutover",
    }),
    packagePlan({
      consumers: ["assignment_recipients"],
      dependsOn: ["LE-001-5D"],
      id: "LE-001-5E",
      title: "Assignment Recipient Canonicalization",
    }),
    packagePlan({
      consumers: ["submission_self_resolution"],
      dependsOn: ["LE-001-5E"],
      id: "LE-001-5F",
      title: "Submission Self-Resolution Cutover",
    }),
    packagePlan({
      consumers: ["learning_events"],
      dependsOn: ["LE-001-5F"],
      id: "LE-001-5G",
      title: "Learning Event Canonicalization",
    }),
    packagePlan({
      consumers: ["mastery_subject_projections"],
      dependsOn: ["LE-001-5G"],
      id: "LE-001-5H",
      title: "Mastery Projection Rebuild",
    }),
    packagePlan({
      consumers: ["adaptive_recommendations"],
      dependsOn: ["LE-001-5H"],
      id: "LE-001-5I",
      title: "Adaptive Consumer Cutover",
    }),
    packagePlan({
      consumers: ["guardian_verification", "parent_portal"],
      dependsOn: ["LE-001-5A", "LE-001-5C", "LE-001-5I"],
      id: "LE-001-5J",
      title: "Guardian and Parent Portal Canonical Child Cutover",
    }),
  ]);

export interface PackageOrderValidation {
  readonly missingDependencies: readonly string[];
  readonly valid: boolean;
}

export function validateLearnerCutoverPackageOrder(
  order: readonly LearnerCutoverPackageId[],
): PackageOrderValidation {
  const duplicates = order.filter(
    (packageId, index) => order.indexOf(packageId) !== index,
  );
  const unknown = order.filter(
    (packageId) => !LEARNER_CUTOVER_PACKAGE_IDS.includes(packageId),
  );
  const byId = new Map(LEARNER_CUTOVER_PACKAGES.map((item) => [item.id, item]));
  const missingDependencies: string[] = [
    ...duplicates.map((value) => `duplicate:${value}`),
    ...unknown.map((value) => `unknown:${value}`),
  ];
  for (const [index, packageId] of order.entries()) {
    const plan = byId.get(packageId);
    if (!plan) continue;
    for (const dependency of plan.dependsOn) {
      const dependencyIndex = order.indexOf(dependency);
      if (dependencyIndex < 0 || dependencyIndex >= index) {
        missingDependencies.push(`${packageId}:${dependency}`);
      }
    }
  }
  for (const expected of LEARNER_CUTOVER_PACKAGE_IDS) {
    if (!order.includes(expected))
      missingDependencies.push(`missing:${expected}`);
  }
  return Object.freeze({
    missingDependencies: Object.freeze([...new Set(missingDependencies)]),
    valid: missingDependencies.length === 0,
  });
}

export function validateLearnerCutoverDependencyGraph(): boolean {
  const visited = new Set<LearnerCutoverConsumer>();
  const active = new Set<LearnerCutoverConsumer>();

  function visit(consumer: LearnerCutoverConsumer): boolean {
    if (active.has(consumer)) return false;
    if (visited.has(consumer)) return true;
    active.add(consumer);
    for (const dependency of LEARNER_CUTOVER_DEPENDENCY_GRAPH[consumer]) {
      if (!visit(dependency)) return false;
    }
    active.delete(consumer);
    visited.add(consumer);
    return true;
  }

  return LEARNER_CUTOVER_CONSUMERS.every(visit);
}
