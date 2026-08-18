import "server-only";

import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { analyzeLearnerEnrollmentParity } from "@/lib/learner-convergence/application/analyze-parity";
import { canonicalStudentResolutionSchema } from "@/lib/learner-convergence/application/validation";
import type {
  CanonicalStudentResolution,
  LearnerParityReport,
} from "@/lib/learner-convergence/domain/model";
import { LearnerConvergenceError } from "@/lib/learner-convergence/errors";
import { OrganizationError } from "@/lib/organization/errors";
import {
  requireOrganizationMembership,
  requireOrganizationRole,
} from "@/lib/organization/service";
import { createClient } from "@/lib/supabase/server";

function mapOrganizationError(error: OrganizationError) {
  if (error.code === "not_authenticated") {
    return new LearnerConvergenceError("not_authenticated", { cause: error });
  }
  if (error.code === "organization_not_found" || error.code === "not_member") {
    return new LearnerConvergenceError("inactive_context", { cause: error });
  }
  if (error.code === "forbidden") {
    return new LearnerConvergenceError("forbidden", { cause: error });
  }
  return new LearnerConvergenceError("service_unavailable", { cause: error });
}

function mapDatabaseError(error: unknown) {
  return new LearnerConvergenceError("service_unavailable", { cause: error });
}

export async function analyzeCurrentOrganizationLearnerParity(): Promise<LearnerParityReport> {
  let context;
  try {
    context = await requireOrganizationRole([
      "organization_owner",
      "organization_admin",
    ]);
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "get_learner_convergence_snapshot",
  );
  if (error) throw mapDatabaseError(error);

  try {
    const report = analyzeLearnerEnrollmentParity(data);
    if (report.organizationId !== context.organization.id) {
      throw new LearnerConvergenceError("invalid_snapshot");
    }
    console.info(
      "[learner-convergence]",
      JSON.stringify({
        action: "parity_analyzed",
        ambiguousLinks: report.summary.ambiguous_links,
        canonicalStudents: report.summary.canonical_students,
        crossTenantMismatches: report.summary.cross_tenant_mismatch_count,
        discrepancyCount: report.discrepancies.length,
        legacyOnlyEnrollments: report.summary.legacy_only_enrollments,
        organizationId: report.organizationId,
      }),
    );
    return report;
  } catch (error: unknown) {
    if (error instanceof LearnerConvergenceError) throw error;
    if (error instanceof ZodError) {
      throw new LearnerConvergenceError("invalid_snapshot", { cause: error });
    }
    throw error;
  }
}

export async function resolveCanonicalStudentForAuthenticatedAccount(): Promise<CanonicalStudentResolution> {
  const user = await getCurrentUser();
  if (!user) throw new LearnerConvergenceError("not_authenticated");

  let context;
  try {
    context = await requireOrganizationMembership();
  } catch (error: unknown) {
    if (error instanceof OrganizationError) {
      if (
        error.code === "organization_not_found" ||
        error.code === "not_member"
      ) {
        return Object.freeze({ outcome: "inactive_context" });
      }
      throw mapOrganizationError(error);
    }
    throw error;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "resolve_canonical_student_for_authenticated_account",
  );
  if (error) throw mapDatabaseError(error);

  const parsed = canonicalStudentResolutionSchema.safeParse(data);
  if (!parsed.success) {
    throw new LearnerConvergenceError("invalid_snapshot", {
      cause: parsed.error,
    });
  }
  if (
    parsed.data.outcome === "linked" &&
    parsed.data.organizationId !== context.organization.id
  ) {
    throw new LearnerConvergenceError("invalid_snapshot");
  }
  return Object.freeze({ ...parsed.data });
}
