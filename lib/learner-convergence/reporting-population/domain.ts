import type { ClassRosterStudentProjection } from "@/lib/learner-convergence/class-roster/domain";
import type { LearnerCutoverControlMode } from "@/lib/learner-convergence/cutover/domain";

export const REPORTING_POPULATION_VERSION =
  "le-001.reporting-population.v1" as const;

export type ReportingPopulationActorRole =
  "organization_admin" | "organization_owner" | "teacher";

export interface ReportingMetricCompatibilityReference {
  readonly canonicalStudentId: string;
  readonly classId: string;
  readonly legacyMetricStudentId: string;
}

export interface ReportingMetricCompatibilityResult {
  readonly canonicalLearnersWithoutLegacyMetrics: number;
  readonly identityUnresolvedCount: number;
  readonly references: readonly ReportingMetricCompatibilityReference[];
}

export interface ReportingMetricCompatibilityResolver {
  resolve(
    entries: readonly ClassRosterStudentProjection[],
  ): Promise<ReportingMetricCompatibilityResult>;
}

export interface ReportingPopulationAuthorityEvent {
  readonly actorRole: ReportingPopulationActorRole;
  readonly canonicalLearnersWithoutLegacyMetrics: number;
  readonly canonicalPopulationCount: number | null;
  readonly classCount: number;
  readonly compatibilityMappingCount: number;
  readonly correlationId: string;
  readonly fallbackReason: "canonical_read_failure" | null;
  readonly fallbackUsed: boolean;
  readonly identityUnresolvedCount: number;
  readonly legacyPopulationCount: number | null;
  readonly mode: LearnerCutoverControlMode;
  readonly organizationId: string;
  readonly returnedAuthority: "CANONICAL" | "LEGACY";
  readonly shadowErrorCount: number;
  readonly version: typeof REPORTING_POPULATION_VERSION;
}

export interface ReportingPopulationAuthorityObserver {
  record(event: ReportingPopulationAuthorityEvent): void;
}

export interface ReportingPopulationReadResult {
  readonly authority: "CANONICAL" | "LEGACY";
  readonly canonicalLearnersWithoutLegacyMetrics: number;
  readonly canonicalPopulationCount: number | null;
  readonly entries: readonly ClassRosterStudentProjection[];
  readonly fallbackUsed: boolean;
  readonly identityUnresolvedCount: number;
  readonly legacyPopulationCount: number | null;
  readonly metricCompatibilityReferences: readonly ReportingMetricCompatibilityReference[];
  readonly mode: LearnerCutoverControlMode;
  readonly shadowErrorCount: number;
  readonly version: typeof REPORTING_POPULATION_VERSION;
}

export interface ReportingPopulationParityMetrics {
  readonly canonicalLearnersWithoutLegacyMetrics: number;
  readonly canonicalPopulationCount: number;
  readonly expectedCanonicalOnlyCount: number;
  readonly identityUnresolvedCount: number;
  readonly legacyOnlyCount: number;
  readonly legacyPopulationCount: number;
  readonly matchCount: number;
  readonly metricCompatibilityCount: number;
  readonly shadowErrorCount: number;
  readonly statusMismatchCount: number;
  readonly tenantMismatchCount: number;
  readonly unexpectedCanonicalOnlyCount: number;
  readonly version: typeof REPORTING_POPULATION_VERSION;
}
