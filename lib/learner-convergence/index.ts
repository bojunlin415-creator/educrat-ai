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
