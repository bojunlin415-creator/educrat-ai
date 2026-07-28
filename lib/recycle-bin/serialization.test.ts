import { describe, expect, it } from "vitest";

import { RECYCLE_BIN_CONTRACT_VERSION } from "@/lib/recycle-bin/domain/definition";
import type { RestoreRequest } from "@/lib/recycle-bin/domain/request";
import { serializeRecycleBinCanonical } from "@/lib/recycle-bin/domain/serialization";
import type {
  RecycleBinActorId,
  RecycleBinResourceId,
  RecycleBinResourceType,
} from "@/lib/recycle-bin/shared/references";

const resourceType = "CURRICULUM" as RecycleBinResourceType;
const resourceId = "curriculum-001" as RecycleBinResourceId;
const requestedBy = "actor-001" as RecycleBinActorId;

describe("serializeRecycleBinCanonical", () => {
  it("serializes equivalent requests deterministically", () => {
    const left: RestoreRequest = {
      requestedBy,
      resourceId,
      resourceType,
      version: RECYCLE_BIN_CONTRACT_VERSION,
    };
    const right: RestoreRequest = {
      version: RECYCLE_BIN_CONTRACT_VERSION,
      resourceType,
      resourceId,
      requestedBy,
    };

    expect(serializeRecycleBinCanonical(left)).toBe(
      serializeRecycleBinCanonical(right),
    );
  });

  it("rejects circular values", () => {
    const value: Record<string, unknown> = { resourceType };
    value.self = value;

    expect(() =>
      serializeRecycleBinCanonical(
        value as unknown as Parameters<typeof serializeRecycleBinCanonical>[0],
      ),
    ).toThrow("Cannot serialize circular recycle bin value.");
  });
});
