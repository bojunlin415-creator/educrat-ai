import "server-only";

export {
  analyzeBackfillCandidates,
  classifyLearnerCandidate,
} from "@/lib/learner-convergence/application/backfill-candidates";
export { executeVerifiedLearnerBackfill } from "@/lib/learner-convergence/application/execute-backfill";
export {
  analyzeEnrollmentParity,
  executeDeterministicEnrollmentBackfill,
} from "@/lib/learner-convergence/application/enrollment-parity";

export type {
  CanonicalEnrollmentBackfillGateway,
  LearnerAccountLinkBackfillGateway,
} from "@/lib/learner-convergence/interfaces/backfill-gateway";
