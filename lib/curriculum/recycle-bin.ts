import {
  evaluatePermanentDeletion,
  evaluateRestore,
  RecycleBinRegistry,
  type PermanentDeletionDecision,
  type PermanentDeletionRequest,
  type RecycleBinPolicy,
  type RecycleEntry,
  type RestoreDecision,
  type RestoreRequest,
} from "@/lib/recycle-bin";
import type {
  RecycleBinActorId,
  RecycleBinDependencyReference,
  RecycleBinLegalHoldReference,
  RecycleBinMetadataCode,
  RecycleBinOrganizationId,
  RecycleBinRecycleId,
  RecycleBinResourceId,
  RecycleBinResourceType,
  RecycleBinRetentionReference,
  RecycleBinTransition,
} from "@/lib/recycle-bin/shared/references";

interface RecyclableCurriculum {
  readonly deleted_at: string | null;
  readonly deleted_by: string | null;
  readonly id: string;
  readonly latestVersion: number;
  readonly organization_id: string;
}

const CURRICULUM_RECYCLE_RESOURCE = "CURRICULUM";
const PERMANENT_DELETE_TRANSITION = "PERMANENT_DELETE";

const registry = new RecycleBinRegistry({
  resourceTypes: [CURRICULUM_RECYCLE_RESOURCE],
  transitions: ["RESTORE", PERMANENT_DELETE_TRANSITION],
  version: 1,
});

const allowPolicy: RecycleBinPolicy = Object.freeze({
  evaluatePermanentDeletion() {
    return Object.freeze({ decision: "ALLOW" });
  },
  evaluateRestore() {
    return Object.freeze({ decision: "ALLOW" });
  },
});

function toRecycleIso(value: string): string {
  return new Date(value).toISOString();
}

export function curriculumToRecycleEntry(
  curriculum: RecyclableCurriculum,
  options: {
    readonly hasProtectedDependencies: boolean;
    readonly legalHoldReference?: string;
  },
): RecycleEntry {
  const deletedAt = curriculum.deleted_at;
  const deletedBy = curriculum.deleted_by;
  if (!deletedAt || !deletedBy) {
    throw new Error("Invalid recycle entry source.");
  }

  return Object.freeze({
    deletedAt: toRecycleIso(deletedAt),
    deletedBy: deletedBy as RecycleBinActorId,
    dependencyReference: options.hasProtectedDependencies
      ? ("PROTECTED_DEPENDENCY" as RecycleBinDependencyReference)
      : ("NONE" as RecycleBinDependencyReference),
    legalHoldReference: (options.legalHoldReference ??
      "NONE") as RecycleBinLegalHoldReference,
    lifecycleState: "TRASHED",
    metadata: Object.freeze([
      Object.freeze({
        key: "VERSION_COUNT" as RecycleBinMetadataCode,
        value: Math.max(curriculum.latestVersion, 0),
      }),
    ]),
    organizationId: curriculum.organization_id as RecycleBinOrganizationId,
    permanentDeleteEligible: !options.hasProtectedDependencies,
    recycleId: `CURRICULUM:${curriculum.id}` as RecycleBinRecycleId,
    resourceId: curriculum.id as RecycleBinResourceId,
    resourceType: CURRICULUM_RECYCLE_RESOURCE as RecycleBinResourceType,
    restoreEligible: true,
    retentionReference:
      "PI001_NO_RETENTION_HOLD" as RecycleBinRetentionReference,
    retentionUntil: toRecycleIso(deletedAt),
    version: 1,
  });
}

export function evaluateCurriculumRestore(input: {
  readonly actorId: string;
  readonly entry: RecycleEntry;
}): RestoreDecision {
  const request: RestoreRequest = Object.freeze({
    requestedBy: input.actorId as RecycleBinActorId,
    resourceId: input.entry.resourceId,
    resourceType: CURRICULUM_RECYCLE_RESOURCE as RecycleBinResourceType,
    version: 1,
  });
  return evaluateRestore(
    { entry: input.entry, request },
    { policy: allowPolicy, registry },
  );
}

export function evaluateCurriculumPermanentDeletion(input: {
  readonly actorId: string;
  readonly entry: RecycleEntry;
}): PermanentDeletionDecision {
  const request: PermanentDeletionRequest = Object.freeze({
    requestedBy: input.actorId as RecycleBinActorId,
    requestedTransition: PERMANENT_DELETE_TRANSITION as RecycleBinTransition,
    resourceId: input.entry.resourceId,
    resourceType: CURRICULUM_RECYCLE_RESOURCE as RecycleBinResourceType,
    version: 1,
  });
  return evaluatePermanentDeletion(
    { entry: input.entry, request },
    { policy: allowPolicy, registry },
  );
}
