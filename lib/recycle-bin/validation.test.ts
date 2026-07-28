import { describe, expect, it } from "vitest";

import { RecycleBinRegistry } from "@/lib/recycle-bin/application/recycle-bin-registry";
import { RECYCLE_BIN_CONTRACT_VERSION } from "@/lib/recycle-bin/domain/definition";
import { RecycleBinError } from "@/lib/recycle-bin/domain/error";
import {
  validatePermanentDeletionRequest,
  validateRecycleBinPolicyResult,
  validateRecycleEntry,
  validateRestoreRequest,
} from "@/lib/recycle-bin/domain/validation";
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
const transition = "PURGE" as RecycleBinTransition;
const actorId = "actor-001" as RecycleBinActorId;
const resourceId = "resource-001" as RecycleBinResourceId;
const registry = new RecycleBinRegistry({
  resourceTypes: [resourceType],
  transitions: [transition],
  version: RECYCLE_BIN_CONTRACT_VERSION,
});

function validEntry() {
  return {
    deletedAt: "2026-07-23T10:00:00Z",
    deletedBy: actorId,
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

describe("recycle bin validation", () => {
  it("rejects unknown fields in entries", () => {
    expect(() =>
      validateRecycleEntry(
        { ...validEntry(), token: "secret" },
        registry.definition,
      ),
    ).toThrow(new RecycleBinError("INVALID_RECYCLE_BIN_ENTRY"));
  });

  it("rejects invalid lifecycle states", () => {
    expect(() =>
      validateRecycleEntry(
        { ...validEntry(), lifecycleState: "ACTIVE" },
        registry.definition,
      ),
    ).toThrow(new RecycleBinError("INVALID_RECYCLE_BIN_ENTRY"));
  });

  it("rejects invalid restore requests", () => {
    expect(() =>
      validateRestoreRequest(
        {
          requestedBy: actorId,
          resourceId,
          resourceType,
          version: 999,
        },
        registry.definition,
      ),
    ).toThrow(new RecycleBinError("UNSUPPORTED_RECYCLE_BIN_VERSION"));
  });

  it("rejects unknown permanent deletion transitions", () => {
    expect(() =>
      validatePermanentDeletionRequest(
        {
          requestedBy: actorId,
          requestedTransition: "UNKNOWN",
          resourceId,
          resourceType,
          version: RECYCLE_BIN_CONTRACT_VERSION,
        },
        registry.definition,
      ),
    ).toThrow(new RecycleBinError("UNKNOWN_RECYCLE_BIN_TRANSITION"));
  });

  it("rejects malformed policy output", () => {
    expect(() =>
      validateRecycleBinPolicyResult({
        decision: "ALLOW",
        reason: "EXTRA_REASON",
      }),
    ).toThrow(new RecycleBinError("INVALID_RECYCLE_BIN_POLICY_OUTPUT"));
  });
});
