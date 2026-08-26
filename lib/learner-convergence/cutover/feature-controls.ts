import {
  LEARNER_CUTOVER_CONTROL_MODES,
  type LearnerCutoverControlDefinition,
  type LearnerCutoverControlKey,
} from "@/lib/learner-convergence/cutover/domain";

function control(
  definition: Omit<
    LearnerCutoverControlDefinition,
    "defaultMode" | "modes" | "selectedMode"
  > &
    Partial<Pick<LearnerCutoverControlDefinition, "selectedMode">>,
): LearnerCutoverControlDefinition {
  return Object.freeze({
    ...definition,
    defaultMode: "LEGACY_ONLY",
    modes: Object.freeze([...LEARNER_CUTOVER_CONTROL_MODES]),
    selectedMode: definition.selectedMode ?? "LEGACY_ONLY",
  });
}

export const LEARNER_CUTOVER_CONTROLS: Readonly<
  Record<LearnerCutoverControlKey, LearnerCutoverControlDefinition>
> = Object.freeze({
  learner_adaptive_canonical_consumer: control({
    key: "learner_adaptive_canonical_consumer",
    ownerPackage: "LE-001-5I",
  }),
  learner_assignment_canonical_expansion: control({
    key: "learner_assignment_canonical_expansion",
    ownerPackage: "LE-001-5D",
    selectedMode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
  }),
  learner_assignment_recipient_canonical_reference: control({
    key: "learner_assignment_recipient_canonical_reference",
    ownerPackage: "LE-001-5E",
  }),
  learner_class_roster_canonical_read: control({
    key: "learner_class_roster_canonical_read",
    ownerPackage: "LE-001-5A",
    selectedMode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
  }),
  learner_guardian_canonical_child: control({
    key: "learner_guardian_canonical_child",
    ownerPackage: "LE-001-5J",
  }),
  learner_learning_event_canonical_reference: control({
    key: "learner_learning_event_canonical_reference",
    ownerPackage: "LE-001-5G",
  }),
  learner_mastery_canonical_projection: control({
    key: "learner_mastery_canonical_projection",
    ownerPackage: "LE-001-5H",
  }),
  learner_parent_portal_canonical_child: control({
    key: "learner_parent_portal_canonical_child",
    ownerPackage: "LE-001-5J",
  }),
  learner_reporting_canonical_population: control({
    key: "learner_reporting_canonical_population",
    ownerPackage: "LE-001-5C",
    selectedMode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
  }),
  learner_submission_canonical_self: control({
    key: "learner_submission_canonical_self",
    ownerPackage: "LE-001-5F",
  }),
  learner_teacher_dashboard_canonical_population: control({
    key: "learner_teacher_dashboard_canonical_population",
    ownerPackage: "LE-001-5B",
    selectedMode: "CANONICAL_PRIMARY_LEGACY_FALLBACK",
  }),
});

export function getLearnerCutoverControl(
  key: LearnerCutoverControlKey,
): LearnerCutoverControlDefinition {
  return LEARNER_CUTOVER_CONTROLS[key];
}
