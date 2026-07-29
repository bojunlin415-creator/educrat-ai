import "server-only";

import { createHash, randomUUID } from "node:crypto";
import {
  AuditWriter,
  type AuditChainHead,
  type AuditChainReference,
  type AuditEvent,
  type AuditHash,
  type AuditIdentifier,
  type AuditReceipt,
} from "@/lib/audit";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { SupabaseServerClient } from "@/lib/supabase/server";

type CurriculumAuditAction =
  | "CURRICULUM_ARCHIVED"
  | "CURRICULUM_AI_EDITED"
  | "CURRICULUM_AI_GENERATED"
  | "CURRICULUM_AI_SAVED"
  | "CURRICULUM_EXPORTED"
  | "CURRICULUM_PERMANENTLY_DELETED"
  | "CURRICULUM_PUBLISHED"
  | "CURRICULUM_RESTORED"
  | "CURRICULUM_REVIEWED"
  | "CURRICULUM_SOFT_DELETED"
  | "CURRICULUM_SUBMITTED";

type CurriculumAuditInsert =
  Database["public"]["Tables"]["curriculum_lifecycle_audit_events"]["Insert"];

interface CurriculumAuditRepositoryInput {
  readonly actingRole: string;
  readonly curriculumId: string;
  readonly stateAfter: string;
  readonly stateBefore: string;
  readonly supabase: SupabaseServerClient;
}

class CurriculumLifecycleAuditRepository {
  readonly #input: CurriculumAuditRepositoryInput;

  constructor(input: CurriculumAuditRepositoryInput) {
    this.#input = input;
  }

  async getChainHead(
    chain: AuditChainReference,
  ): Promise<AuditChainHead | null> {
    if (chain.organizationId === null) return null;

    const { data, error } = await this.#input.supabase
      .from("curriculum_lifecycle_audit_events")
      .select("event_id,occurred_at,current_hash,version")
      .eq("organization_id", chain.organizationId)
      .order("occurred_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;

    return Object.freeze({
      chainId: chain.chainId,
      currentHash: data.current_hash as AuditHash,
      eventId: data.event_id,
      occurredAt: new Date(data.occurred_at).toISOString(),
      version: 1,
    });
  }

  async append(event: AuditEvent): Promise<void> {
    if (event.organizationId === null) return;

    const row: CurriculumAuditInsert = {
      action: event.action as CurriculumAuditAction,
      acting_role: this.#input.actingRole,
      actor_id: event.actorId,
      actor_type: "ACCOUNT",
      correlation_id: event.correlationId,
      current_hash: event.currentHash,
      curriculum_id: this.#input.curriculumId,
      event_id: event.eventId,
      metadata: event.metadata as Json,
      occurred_at: event.occurredAt,
      organization_id: event.organizationId,
      previous_hash: event.previousHash,
      reason: event.reason,
      request_id: event.requestId,
      result: event.result,
      state_after: this.#input.stateAfter,
      state_before: this.#input.stateBefore,
      version: event.version,
    };
    const { error } = await this.#input.supabase
      .from("curriculum_lifecycle_audit_events")
      .insert(row);
    if (error) throw error;
  }
}

export async function writeCurriculumLifecycleAudit(input: {
  readonly action: CurriculumAuditAction;
  readonly actorId: string;
  readonly actingRole: string;
  readonly curriculumId: string;
  readonly metadata?: Record<string, boolean | null | number | string>;
  readonly organizationId: string;
  readonly reason: string;
  readonly result?: "DENIED" | "FAILED" | "SUCCEEDED";
  readonly stateAfter: string;
  readonly stateBefore: string;
  readonly supabase: SupabaseServerClient;
}): Promise<AuditReceipt> {
  const repository = new CurriculumLifecycleAuditRepository({
    actingRole: input.actingRole,
    curriculumId: input.curriculumId,
    stateAfter: input.stateAfter,
    stateBefore: input.stateBefore,
    supabase: input.supabase,
  });
  const writer = new AuditWriter({
    clock: {
      now: () => new Date().toISOString(),
    },
    hashChain: {
      async calculateHash(payload) {
        return createHash("sha256").update(payload).digest("hex");
      },
    },
    idGenerator: {
      generateEventId: () => randomUUID(),
    },
    repository,
  });

  const requestId = `pi001:${randomUUID()}` as AuditIdentifier;
  return writer.write({
    action: input.action,
    actingRole: input.actingRole.toUpperCase(),
    actorId: input.actorId,
    actorType: "ACCOUNT",
    correlationId: requestId,
    metadata: {
      ...input.metadata,
      operationClass: input.action.startsWith("CURRICULUM_AI_")
        ? "CURRICULUM_AI_GENERATION"
        : input.action === "CURRICULUM_EXPORTED"
          ? "CURRICULUM_EXPORT"
          : input.action === "CURRICULUM_SUBMITTED" ||
              input.action === "CURRICULUM_REVIEWED" ||
              input.action === "CURRICULUM_PUBLISHED"
            ? "CURRICULUM_PUBLISH"
            : "CURRICULUM_LIFECYCLE",
      stateAfter: input.stateAfter.toUpperCase(),
      stateBefore: input.stateBefore.toUpperCase(),
    },
    organizationId: input.organizationId,
    platformScope: false,
    reason: input.reason,
    requestId,
    resourceId: input.curriculumId,
    resourceType: "CURRICULUM",
    result: input.result ?? "SUCCEEDED",
    source: input.action.startsWith("CURRICULUM_AI_")
      ? "AI_CURRICULUM_SERVICE"
      : input.action === "CURRICULUM_EXPORTED"
        ? "CURRICULUM_EXPORT_SERVICE"
        : input.action === "CURRICULUM_SUBMITTED" ||
            input.action === "CURRICULUM_REVIEWED" ||
            input.action === "CURRICULUM_PUBLISHED"
          ? "CURRICULUM_PUBLISH_SERVICE"
          : "CURRICULUM_SERVICE",
  });
}
