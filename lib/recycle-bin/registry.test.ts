import { describe, expect, it } from "vitest";

import { RecycleBinRegistry } from "@/lib/recycle-bin/application/recycle-bin-registry";
import { RECYCLE_BIN_CONTRACT_VERSION } from "@/lib/recycle-bin/domain/definition";
import { RecycleBinError } from "@/lib/recycle-bin/domain/error";
import type {
  RecycleBinResourceType,
  RecycleBinTransition,
} from "@/lib/recycle-bin/shared/references";

const curriculum = "CURRICULUM" as RecycleBinResourceType;
const lesson = "LESSON" as RecycleBinResourceType;
const purge = "PURGE" as RecycleBinTransition;
const restore = "RESTORE" as RecycleBinTransition;

describe("RecycleBinRegistry", () => {
  it("sorts and freezes vocabulary", () => {
    const registry = new RecycleBinRegistry({
      resourceTypes: [lesson, curriculum],
      transitions: [restore, purge],
      version: RECYCLE_BIN_CONTRACT_VERSION,
    });

    expect(registry.definition.resourceTypes).toEqual(["CURRICULUM", "LESSON"]);
    expect(registry.definition.transitions).toEqual(["PURGE", "RESTORE"]);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(Object.isFrozen(registry.definition.resourceTypes)).toBe(true);
  });

  it("rejects duplicate vocabulary", () => {
    expect(
      () =>
        new RecycleBinRegistry({
          resourceTypes: [curriculum, curriculum],
          transitions: [purge],
          version: RECYCLE_BIN_CONTRACT_VERSION,
        }),
    ).toThrow(new RecycleBinError("DUPLICATE_RECYCLE_BIN_RESOURCE_TYPE"));
  });

  it("does not expose mutation methods", () => {
    const registry = new RecycleBinRegistry({
      resourceTypes: [curriculum],
      transitions: [purge],
      version: RECYCLE_BIN_CONTRACT_VERSION,
    });

    expect("register" in registry).toBe(false);
    expect("update" in registry).toBe(false);
    expect("delete" in registry).toBe(false);
  });
});
