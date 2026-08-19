import { analyzeLearnerShadowConsumer } from "@/lib/learner-convergence/shadow/analyze";
import type {
  LearnerShadowConsumer,
  LearnerShadowObservation,
  LearnerShadowScope,
} from "@/lib/learner-convergence/shadow/domain";
import type {
  LearnerShadowDiagnosticSink,
  LearnerShadowSnapshotProvider,
} from "@/lib/learner-convergence/shadow/interfaces";

export async function runLearnerShadowObservation(input: {
  readonly consumer: LearnerShadowConsumer;
  readonly correlationId: string;
  readonly enabled: boolean;
  readonly organizationId: string | null;
  readonly scope?: LearnerShadowScope;
  readonly sink: LearnerShadowDiagnosticSink;
  readonly snapshotProvider: LearnerShadowSnapshotProvider;
}): Promise<LearnerShadowObservation> {
  if (!input.enabled) {
    return Object.freeze({ outcome: "DISABLED", result: null });
  }
  try {
    const snapshot =
      await input.snapshotProvider.loadCurrentOrganizationSnapshot();
    if (
      input.organizationId !== null &&
      snapshot.organizationId !== input.organizationId
    ) {
      throw Object.assign(new Error("shadow_tenant_mismatch"), {
        code: "shadow_tenant_mismatch",
      });
    }
    const result = analyzeLearnerShadowConsumer({
      consumer: input.consumer,
      scope: input.scope,
      snapshot,
    });
    input.sink.record({
      correlationId: input.correlationId,
      result,
    });
    return Object.freeze({ outcome: "COMPLETED", result });
  } catch (error: unknown) {
    const safeErrorCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "shadow_read_failed";
    input.sink.recordFailure({
      consumer: input.consumer,
      correlationId: input.correlationId,
      organizationId: input.organizationId,
      safeErrorCode,
    });
    return Object.freeze({ outcome: "FAILED", result: null });
  }
}

export async function preserveLegacyResult<T>(input: {
  readonly legacyOperation: () => Promise<T>;
  readonly shadowOperation: (legacyResult: T) => Promise<unknown>;
}): Promise<T> {
  const result = await input.legacyOperation();
  try {
    await input.shadowOperation(result);
  } catch {
    // Shadow diagnostics are never allowed to change legacy runtime behavior.
  }
  return result;
}
