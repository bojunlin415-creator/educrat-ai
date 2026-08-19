import "server-only";

import { randomUUID } from "node:crypto";
import { learnerParitySnapshotSchema } from "@/lib/learner-convergence/application/validation";
import type { LearnerParitySnapshot } from "@/lib/learner-convergence/domain/model";
import { requireOrganizationMembership } from "@/lib/organization/service";
import { createClient } from "@/lib/supabase/server";
import { analyzeLearnerShadowSuite } from "@/lib/learner-convergence/shadow/analyze";
import type {
  LearnerShadowConsumer,
  LearnerShadowConsumerResult,
  LearnerShadowObservation,
  LearnerShadowScope,
} from "@/lib/learner-convergence/shadow/domain";
import type {
  LearnerShadowDiagnosticSink,
  LearnerShadowSnapshotProvider,
} from "@/lib/learner-convergence/shadow/interfaces";
import { runLearnerShadowObservation } from "@/lib/learner-convergence/shadow/run";

const ENABLED_VALUES = new Set(["1", "enabled", "true"]);

export function isLearnerShadowReadEnabled(
  value = process.env.LEARNER_CONVERGENCE_SHADOW_READ,
): boolean {
  return ENABLED_VALUES.has(value?.trim().toLowerCase() ?? "");
}

function safeDatabaseCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return "shadow_snapshot_unavailable";
}

class SupabaseLearnerShadowSnapshotProvider implements LearnerShadowSnapshotProvider {
  async loadCurrentOrganizationSnapshot(): Promise<LearnerParitySnapshot> {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc(
      "get_learner_convergence_snapshot",
    );
    if (error) {
      throw Object.assign(new Error("shadow_snapshot_unavailable"), {
        code: safeDatabaseCode(error),
      });
    }
    return learnerParitySnapshotSchema.parse(data);
  }
}

export class ConsoleLearnerShadowDiagnosticSink implements LearnerShadowDiagnosticSink {
  record(input: {
    readonly correlationId: string;
    readonly result: LearnerShadowConsumerResult;
  }): void {
    const { correlationId, result } = input;
    console.info(
      "[learner-shadow]",
      JSON.stringify({
        consumer: result.consumer,
        correlation: correlationId,
        organization: result.organizationId,
        parityState:
          result.discrepancies.length === 0 ? "PARITY_MATCH" : "DISCREPANCY",
        readiness: result.readiness,
        summary: result.summary,
        version: result.version,
      }),
    );
    for (const discrepancy of result.discrepancies.slice(0, 20)) {
      console.info(
        "[learner-shadow]",
        JSON.stringify({
          canonicalReference: discrepancy.canonicalReference,
          consumer: discrepancy.consumer,
          correlation: correlationId,
          legacyReference: discrepancy.legacyReference,
          organization: result.organizationId,
          parityState: discrepancy.parityState,
          reason: discrepancy.reasonCode,
        }),
      );
    }
  }

  recordFailure(input: {
    readonly consumer: LearnerShadowConsumer;
    readonly correlationId: string;
    readonly organizationId: string | null;
    readonly safeErrorCode: string;
  }): void {
    console.error(
      "[learner-shadow]",
      JSON.stringify({
        consumer: input.consumer,
        correlation: input.correlationId,
        errorCode: input.safeErrorCode,
        increment: 1,
        metric: "learner_shadow_error",
        organization: input.organizationId,
        parityState: "SHADOW_ERROR",
      }),
    );
  }
}

export async function observeLearnerShadowConsumer(input: {
  readonly consumer: LearnerShadowConsumer;
  readonly correlationId?: string;
  readonly scope?: LearnerShadowScope;
}): Promise<LearnerShadowObservation> {
  const enabled = isLearnerShadowReadEnabled();
  if (!enabled) {
    return runLearnerShadowObservation({
      consumer: input.consumer,
      correlationId: input.correlationId ?? randomUUID(),
      enabled: false,
      organizationId: null,
      scope: input.scope,
      sink: new ConsoleLearnerShadowDiagnosticSink(),
      snapshotProvider: new SupabaseLearnerShadowSnapshotProvider(),
    });
  }
  let organizationId: string | null = null;
  try {
    const context = await requireOrganizationMembership();
    organizationId = context.organization.id;
  } catch {
    // The observation runner records a sanitized failure without changing runtime.
  }
  return runLearnerShadowObservation({
    consumer: input.consumer,
    correlationId: input.correlationId ?? randomUUID(),
    enabled,
    organizationId,
    scope: input.scope,
    sink: new ConsoleLearnerShadowDiagnosticSink(),
    snapshotProvider: new SupabaseLearnerShadowSnapshotProvider(),
  });
}

export async function loadDevelopmentLearnerShadowParity(input?: {
  readonly adaptiveLegacyAccountIds?: readonly string[];
  readonly assignmentClassIds?: readonly string[];
}): Promise<readonly LearnerShadowConsumerResult[]> {
  const context = await requireOrganizationMembership();
  const snapshot =
    await new SupabaseLearnerShadowSnapshotProvider().loadCurrentOrganizationSnapshot();
  if (snapshot.organizationId !== context.organization.id) {
    throw Object.assign(new Error("shadow_tenant_mismatch"), {
      code: "shadow_tenant_mismatch",
    });
  }
  return analyzeLearnerShadowSuite({
    adaptiveLegacyAccountIds: input?.adaptiveLegacyAccountIds,
    assignmentClassIds: input?.assignmentClassIds,
    snapshot,
  });
}
