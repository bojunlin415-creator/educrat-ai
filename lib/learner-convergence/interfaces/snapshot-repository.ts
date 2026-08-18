import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";

export interface LearnerParitySnapshotRepository {
  loadCurrentOrganizationSnapshot(): Promise<LearnerParitySnapshot>;
}
