export { analyzeLearnerEnrollmentParity } from "@/lib/learner-convergence/application/analyze-parity";
export {
  analyzeBackfillCandidates,
  classifyLearnerCandidate,
} from "@/lib/learner-convergence/application/backfill-candidates";
export { executeVerifiedLearnerBackfill } from "@/lib/learner-convergence/application/execute-backfill";
export {
  analyzeEnrollmentParity,
  executeDeterministicEnrollmentBackfill,
} from "@/lib/learner-convergence/application/enrollment-parity";
export { learnerParitySnapshotSchema } from "@/lib/learner-convergence/application/validation";
export { evaluatePhase4DevelopmentReadiness } from "@/lib/learner-convergence/cutover/development-readiness";
export {
  LEARNER_CUTOVER_DEPENDENCY_GRAPH,
  LEARNER_CUTOVER_PACKAGES,
  validateLearnerCutoverDependencyGraph,
  validateLearnerCutoverPackageOrder,
} from "@/lib/learner-convergence/cutover/dependency-graph";
export * from "@/lib/learner-convergence/cutover/domain";
export { evaluateConsumerCutoverReadiness } from "@/lib/learner-convergence/cutover/evaluate";
export {
  getLearnerCutoverControl,
  LEARNER_CUTOVER_CONTROLS,
} from "@/lib/learner-convergence/cutover/feature-controls";
export {
  LEARNER_CONSUMER_CUTOVER_PLANS,
  TEACHER_DASHBOARD_POPULATION_PLANS,
} from "@/lib/learner-convergence/cutover/plan";
export type {
  GuardianLearnerProjection,
  LearnerCutoverSnapshotProvider,
  OwnerAdminLearnerProjection,
  StudentSelfLearnerProjection,
  TeacherLearnerProjection,
  TrustedLearnerSnapshotScope,
} from "@/lib/learner-convergence/cutover/snapshot-contract";
export * from "@/lib/learner-convergence/domain/model";
export * from "@/lib/learner-convergence/domain/phase-3";
export { mapLegacyEnrollmentStatus } from "@/lib/learner-convergence/domain/status-compatibility";
export {
  analyzeLearnerShadowConsumer,
  analyzeLearnerShadowSuite,
} from "@/lib/learner-convergence/shadow/analyze";
export * from "@/lib/learner-convergence/shadow/domain";
export { preserveLegacyResult } from "@/lib/learner-convergence/shadow/run";
export type {
  LearnerShadowDiagnosticSink,
  LearnerShadowSnapshotProvider,
} from "@/lib/learner-convergence/shadow/interfaces";
export type {
  CanonicalEnrollmentBackfillGateway,
  LearnerAccountLinkBackfillGateway,
} from "@/lib/learner-convergence/interfaces/backfill-gateway";
export type { LearnerParitySnapshotRepository } from "@/lib/learner-convergence/interfaces/snapshot-repository";
