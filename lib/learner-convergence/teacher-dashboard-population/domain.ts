import type { ClassRosterStudentProjection } from "@/lib/learner-convergence/class-roster/domain";
import type { LearnerCutoverControlMode } from "@/lib/learner-convergence/cutover/domain";

export const TEACHER_DASHBOARD_POPULATION_VERSION =
  "le-001.teacher-dashboard-population.v1" as const;

export interface TeacherDashboardPopulationAuthorityEvent {
  readonly actorRole: "organization_admin" | "organization_owner" | "teacher";
  readonly canonicalPopulationCount: number | null;
  readonly classCount: number;
  readonly correlationId: string;
  readonly fallbackReason: "canonical_read_failure" | null;
  readonly fallbackUsed: boolean;
  readonly legacyPopulationCount: number | null;
  readonly mode: LearnerCutoverControlMode;
  readonly organizationId: string;
  readonly returnedAuthority: "CANONICAL" | "LEGACY";
  readonly shadowErrorCount: number;
  readonly version: typeof TEACHER_DASHBOARD_POPULATION_VERSION;
}

export interface TeacherDashboardPopulationAuthorityObserver {
  record(event: TeacherDashboardPopulationAuthorityEvent): void;
}

export interface TeacherDashboardPopulationReadResult {
  readonly authority: "CANONICAL" | "LEGACY";
  readonly canonicalPopulationCount: number | null;
  readonly entries: readonly ClassRosterStudentProjection[];
  readonly fallbackUsed: boolean;
  readonly legacyPopulationCount: number | null;
  readonly mode: LearnerCutoverControlMode;
  readonly shadowErrorCount: number;
  readonly version: typeof TEACHER_DASHBOARD_POPULATION_VERSION;
}
