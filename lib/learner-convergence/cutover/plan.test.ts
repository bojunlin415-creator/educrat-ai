import {
  LEARNER_CUTOVER_CONSUMERS,
  LEARNER_CUTOVER_PACKAGE_IDS,
  TEACHER_DASHBOARD_POPULATIONS,
} from "@/lib/learner-convergence/cutover/domain";
import {
  LEARNER_CUTOVER_DEPENDENCY_GRAPH,
  validateLearnerCutoverDependencyGraph,
  validateLearnerCutoverPackageOrder,
} from "@/lib/learner-convergence/cutover/dependency-graph";
import { LEARNER_CUTOVER_CONTROLS } from "@/lib/learner-convergence/cutover/feature-controls";
import {
  LEARNER_CONSUMER_CUTOVER_PLANS,
  TEACHER_DASHBOARD_POPULATION_PLANS,
} from "@/lib/learner-convergence/cutover/plan";

describe("LE-001 Phase 5 cutover plan", () => {
  it("defines one immutable plan and a default-legacy control per consumer", () => {
    expect(Object.keys(LEARNER_CONSUMER_CUTOVER_PLANS).sort()).toEqual(
      [...LEARNER_CUTOVER_CONSUMERS].sort(),
    );
    for (const plan of Object.values(LEARNER_CONSUMER_CUTOVER_PLANS)) {
      const control = LEARNER_CUTOVER_CONTROLS[plan.controlKey];
      expect(control.defaultMode).toBe("LEGACY_ONLY");
      expect(control.ownerPackage).toBe(plan.packageId);
      expect(Object.isFrozen(plan)).toBe(true);
      expect(Object.isFrozen(control)).toBe(true);
    }
  });

  it("advances only the independently approved Phase 5A and Phase 5B controls", () => {
    expect(
      LEARNER_CUTOVER_CONTROLS.learner_class_roster_canonical_read.selectedMode,
    ).toBe("CANONICAL_PRIMARY_LEGACY_FALLBACK");
    expect(
      LEARNER_CUTOVER_CONTROLS.learner_teacher_dashboard_canonical_population
        .selectedMode,
    ).toBe("CANONICAL_PRIMARY_LEGACY_FALLBACK");
    expect(
      Object.entries(LEARNER_CUTOVER_CONTROLS)
        .filter(
          ([key]) =>
            key !== "learner_class_roster_canonical_read" &&
            key !== "learner_teacher_dashboard_canonical_population",
        )
        .every(([, control]) => control.selectedMode === "LEGACY_ONLY"),
    ).toBe(true);
  });

  it("keeps Account-link requirements consumer-specific", () => {
    expect(
      LEARNER_CONSUMER_CUTOVER_PLANS.class_read_detail.accountLinkRequirement,
    ).toBe("NOT_REQUIRED");
    expect(
      LEARNER_CONSUMER_CUTOVER_PLANS.assignment_class_expansion
        .managedAccountlessBehavior,
    ).toBe("INCLUDED_BY_CANONICAL_STUDENT");
    expect(
      LEARNER_CONSUMER_CUTOVER_PLANS.submission_self_resolution
        .accountLinkRequirement,
    ).toBe("REQUIRED");
    expect(
      LEARNER_CONSUMER_CUTOVER_PLANS.parent_portal.accountLinkRequirement,
    ).toBe("NOT_REQUIRED");
  });

  it("keeps dashboard populations independently switchable", () => {
    expect(Object.keys(TEACHER_DASHBOARD_POPULATION_PLANS).sort()).toEqual(
      [...TEACHER_DASHBOARD_POPULATIONS].sort(),
    );
    expect(
      Object.values(TEACHER_DASHBOARD_POPULATION_PLANS).every(
        (population) => population.independentlySwitchable,
      ),
    ).toBe(true);
  });

  it("enforces an acyclic consumer graph and the approved package order", () => {
    expect(validateLearnerCutoverDependencyGraph()).toBe(true);
    expect(
      validateLearnerCutoverPackageOrder(LEARNER_CUTOVER_PACKAGE_IDS),
    ).toEqual({ missingDependencies: [], valid: true });
    expect(
      validateLearnerCutoverPackageOrder([
        "LE-001-5E",
        ...LEARNER_CUTOVER_PACKAGE_IDS.filter(
          (packageId) => packageId !== "LE-001-5E",
        ),
      ]).valid,
    ).toBe(false);
    expect(LEARNER_CUTOVER_DEPENDENCY_GRAPH.parent_portal).toContain(
      "guardian_verification",
    );
  });
});
