import { describe, expect, it } from "vitest";

import { RecycleBinRegistry } from "@/lib/recycle-bin/application/recycle-bin-registry";
import { RECYCLE_BIN_CONTRACT_VERSION } from "@/lib/recycle-bin/domain/definition";
import { validateRecycleEntry } from "@/lib/recycle-bin/domain/validation";
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

const resourceType = "CURRICULUM" as RecycleBinResourceType;
const transition = "PURGE" as RecycleBinTransition;

function createRegistry() {
  return new RecycleBinRegistry({
    resourceTypes: [resourceType],
    transitions: [transition],
    version: RECYCLE_BIN_CONTRACT_VERSION,
  });
}

function createEntry() {
  return {
    deletedAt: "2026-07-23T10:00:00Z",
    deletedBy: "actor-001" as RecycleBinActorId,
    dependencyReference: "NONE" as RecycleBinDependencyReference,
    legalHoldReference: "NONE" as RecycleBinLegalHoldReference,
    lifecycleState: "TRASHED",
    metadata: [{ key: "SOURCE" as RecycleBinMetadataCode, value: "TEST" }],
    organizationId: "organization-001" as RecycleBinOrganizationId,
    permanentDeleteEligible: true,
    recycleId: "recycle-001" as RecycleBinRecycleId,
    resourceId: "curriculum-001" as RecycleBinResourceId,
    resourceType,
    restoreEligible: true,
    retentionReference: "retention-001" as RecycleBinRetentionReference,
    retentionUntil: "2026-07-23T10:00:00Z",
    version: RECYCLE_BIN_CONTRACT_VERSION,
  };
}

describe("RecycleEntry model", () => {
  it("validates and freezes recycle entries", () => {
    const entry = validateRecycleEntry(
      createEntry(),
      createRegistry().definition,
    );

    expect(Object.isFrozen(entry)).toBe(true);
    expect(Object.isFrozen(entry.metadata)).toBe(true);
    expect(Object.isFrozen(entry.metadata[0])).toBe(true);
    expect(entry).toMatchObject({
      permanentDeleteEligible: true,
      restoreEligible: true,
      resourceType: "CURRICULUM",
    });
  });

  it("copies metadata instead of preserving caller references", () => {
    const source = createEntry();
    const entry = validateRecycleEntry(source, createRegistry().definition);

    source.metadata[0] = {
      key: "SOURCE" as RecycleBinMetadataCode,
      value: "MUTATED",
    };

    expect(entry.metadata[0]?.value).toBe("TEST");
  });
});
