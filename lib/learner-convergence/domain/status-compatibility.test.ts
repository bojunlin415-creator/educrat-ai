import { mapLegacyEnrollmentStatus } from "@/lib/learner-convergence/domain/status-compatibility";

describe("LE-001 enrollment status compatibility", () => {
  it("maps only deterministic active and left states", () => {
    expect(mapLegacyEnrollmentStatus("active")).toEqual({
      canonicalStatus: "active",
      compatible: true,
    });
    expect(mapLegacyEnrollmentStatus("left")).toEqual({
      canonicalStatus: "left",
      compatible: true,
    });
  });

  it("does not silently map legacy inactive", () => {
    expect(mapLegacyEnrollmentStatus("inactive")).toEqual({
      compatible: false,
      reason: "legacy_inactive_has_no_canonical_equivalent",
    });
  });
});
