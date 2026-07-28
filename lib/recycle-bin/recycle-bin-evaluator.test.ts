import { describe, expect, it } from "vitest";

import {
  evaluatePermanentDeletion,
  evaluateRestore,
} from "@/lib/recycle-bin/application/recycle-bin-evaluator";
import { RecycleBinRegistry } from "@/lib/recycle-bin/application/recycle-bin-registry";
import { RECYCLE_BIN_CONTRACT_VERSION } from "@/lib/recycle-bin/domain/definition";
import type { RecycleBinPolicy } from "@/lib/recycle-bin/interfaces/recycle-bin-policy";
import type {
  RecycleBinActorId,
  RecycleBinDependencyReference,
  RecycleBinLegalHoldReference,
  RecycleBinOrganizationId,
  RecycleBinRecycleId,
  RecycleBinResourceId,
  RecycleBinResourceType,
  RecycleBinRetentionReference,
  RecycleBinTransition,
} from "@/lib/recycle-bin/shared/references";

const resourceType = "CURRICULUM" as RecycleBinResourceType;
const resourceId = "curriculum-001" as RecycleBinResourceId;
const requestedBy = "actor-001" as RecycleBinActorId;
const purge = "PURGE" as RecycleBinTransition;

const registry = new RecycleBinRegistry({
  resourceTypes: [resourceType],
  transitions: [purge],
  version: RECYCLE_BIN_CONTRACT_VERSION,
});

const allowPolicy: RecycleBinPolicy = {
  evaluatePermanentDeletion: () => ({ decision: "ALLOW" }),
  evaluateRestore: () => ({ decision: "ALLOW" }),
};

function createEntry(overrides: Partial<ReturnType<typeof baseEntry>> = {}) {
  return { ...baseEntry(), ...overrides };
}

function baseEntry() {
  return {
    deletedAt: "2026-07-23T10:00:00Z",
    deletedBy: requestedBy,
    dependencyReference: "NONE" as RecycleBinDependencyReference,
    legalHoldReference: "NONE" as RecycleBinLegalHoldReference,
    lifecycleState: "TRASHED",
    metadata: [],
    organizationId: "organization-001" as RecycleBinOrganizationId,
    permanentDeleteEligible: true,
    recycleId: "recycle-001" as RecycleBinRecycleId,
    resourceId,
    resourceType,
    restoreEligible: true,
    retentionReference: "retention-001" as RecycleBinRetentionReference,
    retentionUntil: "2026-07-23T10:00:00Z",
    version: RECYCLE_BIN_CONTRACT_VERSION,
  };
}

function restoreRequest() {
  return {
    requestedBy,
    resourceId,
    resourceType,
    version: RECYCLE_BIN_CONTRACT_VERSION,
  };
}

function permanentDeletionRequest() {
  return {
    ...restoreRequest(),
    requestedTransition: purge,
  };
}

describe("recycle bin evaluator", () => {
  it("allows restore when entry and policy allow it", () => {
    const decision = evaluateRestore(
      { entry: createEntry(), request: restoreRequest() },
      { policy: allowPolicy, registry },
    );

    expect(decision).toEqual({
      allowed: true,
      reason: "RECYCLE_BIN_RESTORE_ALLOWED",
      requiredActions: [],
      version: RECYCLE_BIN_CONTRACT_VERSION,
    });
    expect(Object.isFrozen(decision)).toBe(true);
  });

  it("denies restore when entry is not restorable", () => {
    const decision = evaluateRestore(
      {
        entry: createEntry({ restoreEligible: false }),
        request: restoreRequest(),
      },
      { policy: allowPolicy, registry },
    );

    expect(decision).toMatchObject({
      allowed: false,
      reason: "RECYCLE_BIN_RESTORE_NOT_ELIGIBLE",
      requiredActions: [{ action: "NOT_RESTORABLE" }],
    });
  });

  it("allows permanent deletion when all gates and policy allow it", () => {
    const decision = evaluatePermanentDeletion(
      { entry: createEntry(), request: permanentDeletionRequest() },
      { policy: allowPolicy, registry },
    );

    expect(decision).toEqual({
      allowed: true,
      reason: "RECYCLE_BIN_PERMANENT_DELETION_ALLOWED",
      requiredActions: [],
      version: RECYCLE_BIN_CONTRACT_VERSION,
    });
  });

  it("denies permanent deletion when retention blocks it", () => {
    const decision = evaluatePermanentDeletion(
      {
        entry: createEntry({ retentionUntil: "2026-08-23T10:00:00Z" }),
        request: permanentDeletionRequest(),
      },
      { policy: allowPolicy, registry },
    );

    expect(decision).toMatchObject({
      allowed: false,
      reason: "RECYCLE_BIN_RETENTION_NOT_SATISFIED",
      requiredActions: [{ action: "RETENTION_BLOCKED" }],
    });
  });

  it("denies permanent deletion when dependency blocks it", () => {
    const decision = evaluatePermanentDeletion(
      {
        entry: createEntry({
          dependencyReference:
            "dependency-001" as RecycleBinDependencyReference,
        }),
        request: permanentDeletionRequest(),
      },
      { policy: allowPolicy, registry },
    );

    expect(decision).toMatchObject({
      allowed: false,
      reason: "RECYCLE_BIN_DEPENDENCY_NOT_SATISFIED",
      requiredActions: [{ action: "DEPENDENCY_BLOCKED" }],
    });
  });

  it("fails closed when policy throws", () => {
    const policy: RecycleBinPolicy = {
      evaluatePermanentDeletion: () => {
        throw new Error("policy failure");
      },
      evaluateRestore: () => {
        throw new Error("policy failure");
      },
    };

    expect(
      evaluateRestore(
        { entry: createEntry(), request: restoreRequest() },
        { policy, registry },
      ),
    ).toMatchObject({
      allowed: false,
      reason: "RECYCLE_BIN_POLICY_EVALUATION_FAILED",
      requiredActions: [{ action: "POLICY_ERROR" }],
    });
  });
});
