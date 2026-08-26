import {
  readRosterPopulationByAuthority,
  resolveClassRosterAuthorityMode,
} from "@/lib/learner-convergence/class-roster/authority";
import type { ClassRosterSource } from "@/lib/learner-convergence/class-roster/domain";
import type { LearnerCutoverControlMode } from "@/lib/learner-convergence/cutover/domain";
import {
  REPORTING_POPULATION_VERSION,
  type ReportingMetricCompatibilityResolver,
  type ReportingPopulationActorRole,
  type ReportingPopulationAuthorityObserver,
  type ReportingPopulationReadResult,
} from "@/lib/learner-convergence/reporting-population/domain";

export function resolveReportingPopulationAuthorityMode(input: {
  readonly configuredMode?: string;
  readonly selectedMode: LearnerCutoverControlMode;
}): LearnerCutoverControlMode {
  return resolveClassRosterAuthorityMode(input);
}

export async function readReportingPopulationByAuthority(input: {
  readonly actorRole: ReportingPopulationActorRole;
  readonly classCount: number;
  readonly compatibilityResolver: ReportingMetricCompatibilityResolver;
  readonly correlationId: string;
  readonly mode: LearnerCutoverControlMode;
  readonly observer: ReportingPopulationAuthorityObserver;
  readonly organizationId: string;
  readonly source: ClassRosterSource;
}): Promise<ReportingPopulationReadResult> {
  const population = await readRosterPopulationByAuthority({
    mode: input.mode,
    source: input.source,
  });
  const compatibility =
    population.authority === "CANONICAL"
      ? await input.compatibilityResolver.resolve(population.entries)
      : Object.freeze({
          canonicalLearnersWithoutLegacyMetrics: 0,
          identityUnresolvedCount: 0,
          references: Object.freeze([]),
        });
  const result = Object.freeze({
    authority: population.authority,
    canonicalLearnersWithoutLegacyMetrics:
      compatibility.canonicalLearnersWithoutLegacyMetrics,
    canonicalPopulationCount: population.canonicalCount,
    entries: population.entries,
    fallbackUsed: population.fallbackUsed,
    identityUnresolvedCount: compatibility.identityUnresolvedCount,
    legacyPopulationCount: population.legacyCount,
    metricCompatibilityReferences: compatibility.references,
    mode: population.mode,
    shadowErrorCount: population.shadowErrorCount,
    version: REPORTING_POPULATION_VERSION,
  });
  input.observer.record(
    Object.freeze({
      actorRole: input.actorRole,
      canonicalLearnersWithoutLegacyMetrics:
        result.canonicalLearnersWithoutLegacyMetrics,
      canonicalPopulationCount: result.canonicalPopulationCount,
      classCount: input.classCount,
      compatibilityMappingCount: result.metricCompatibilityReferences.length,
      correlationId: input.correlationId,
      fallbackReason: result.fallbackUsed ? "canonical_read_failure" : null,
      fallbackUsed: result.fallbackUsed,
      identityUnresolvedCount: result.identityUnresolvedCount,
      legacyPopulationCount: result.legacyPopulationCount,
      mode: result.mode,
      organizationId: input.organizationId,
      returnedAuthority: result.authority,
      shadowErrorCount: result.shadowErrorCount,
      version: REPORTING_POPULATION_VERSION,
    }),
  );
  return result;
}
