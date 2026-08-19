import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";
import type { LearnerShadowConsumerResult } from "@/lib/learner-convergence/shadow/domain";

export interface LearnerShadowSnapshotProvider {
  loadCurrentOrganizationSnapshot(): Promise<LearnerParitySnapshot>;
}

export interface LearnerShadowDiagnosticSink {
  record(input: {
    readonly correlationId: string;
    readonly result: LearnerShadowConsumerResult;
  }): void;
  recordFailure(input: {
    readonly consumer: LearnerShadowConsumerResult["consumer"];
    readonly correlationId: string;
    readonly organizationId: string | null;
    readonly safeErrorCode: string;
  }): void;
}
