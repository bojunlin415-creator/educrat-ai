import {
  readRosterPopulationByAuthority,
  resolveClassRosterAuthorityMode,
} from "@/lib/learner-convergence/class-roster/authority";
import type {
  ClassRosterSource,
  ClassRosterStudentProjection,
} from "@/lib/learner-convergence/class-roster/domain";
import type { LearnerCutoverControlMode } from "@/lib/learner-convergence/cutover/domain";
import {
  TEACHER_DASHBOARD_POPULATION_VERSION,
  type TeacherDashboardPopulationAuthorityObserver,
  type TeacherDashboardPopulationReadResult,
} from "@/lib/learner-convergence/teacher-dashboard-population/domain";

export function resolveTeacherDashboardPopulationAuthorityMode(input: {
  readonly configuredMode?: string;
  readonly selectedMode: LearnerCutoverControlMode;
}): LearnerCutoverControlMode {
  return resolveClassRosterAuthorityMode(input);
}

function freezeEntries(
  entries: readonly ClassRosterStudentProjection[],
): readonly ClassRosterStudentProjection[] {
  return Object.freeze(entries.map((entry) => Object.freeze({ ...entry })));
}

export async function readTeacherDashboardPopulationByAuthority(input: {
  readonly actorRole: "organization_admin" | "organization_owner" | "teacher";
  readonly classCount: number;
  readonly correlationId: string;
  readonly mode: LearnerCutoverControlMode;
  readonly observer: TeacherDashboardPopulationAuthorityObserver;
  readonly organizationId: string;
  readonly source: ClassRosterSource;
}): Promise<TeacherDashboardPopulationReadResult> {
  const population = await readRosterPopulationByAuthority({
    mode: input.mode,
    source: input.source,
  });
  const output = Object.freeze({
    authority: population.authority,
    canonicalPopulationCount: population.canonicalCount,
    entries: freezeEntries(population.entries),
    fallbackUsed: population.fallbackUsed,
    legacyPopulationCount: population.legacyCount,
    mode: population.mode,
    shadowErrorCount: population.shadowErrorCount,
    version: TEACHER_DASHBOARD_POPULATION_VERSION,
  });
  input.observer.record(
    Object.freeze({
      actorRole: input.actorRole,
      canonicalPopulationCount: output.canonicalPopulationCount,
      classCount: input.classCount,
      correlationId: input.correlationId,
      fallbackReason: output.fallbackUsed ? "canonical_read_failure" : null,
      fallbackUsed: output.fallbackUsed,
      legacyPopulationCount: output.legacyPopulationCount,
      mode: output.mode,
      organizationId: input.organizationId,
      returnedAuthority: output.authority,
      shadowErrorCount: output.shadowErrorCount,
      version: TEACHER_DASHBOARD_POPULATION_VERSION,
    }),
  );
  return output;
}
