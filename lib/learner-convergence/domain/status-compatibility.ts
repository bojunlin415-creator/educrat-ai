import type {
  CanonicalEnrollmentStatus,
  LegacyEnrollmentStatus,
} from "@/lib/learner-convergence/domain/model";

export type EnrollmentStatusCompatibility =
  | Readonly<{
      canonicalStatus: CanonicalEnrollmentStatus;
      compatible: true;
    }>
  | Readonly<{
      compatible: false;
      reason: "legacy_inactive_has_no_canonical_equivalent";
    }>;

export function mapLegacyEnrollmentStatus(
  status: LegacyEnrollmentStatus,
): EnrollmentStatusCompatibility {
  if (status === "active" || status === "left") {
    return Object.freeze({ canonicalStatus: status, compatible: true });
  }
  return Object.freeze({
    compatible: false,
    reason: "legacy_inactive_has_no_canonical_equivalent",
  });
}
