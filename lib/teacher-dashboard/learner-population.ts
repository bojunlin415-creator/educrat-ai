import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { createClassRosterSource } from "@/lib/classroom/roster";
import { ClassroomError } from "@/lib/classroom/errors";
import { decideClassRosterAccess } from "@/lib/learner-convergence/class-roster/access";
import type { ClassRosterActorRole } from "@/lib/learner-convergence/class-roster/domain";
import { getLearnerCutoverControl } from "@/lib/learner-convergence/cutover/feature-controls";
import {
  readTeacherDashboardPopulationByAuthority,
  resolveTeacherDashboardPopulationAuthorityMode,
} from "@/lib/learner-convergence/teacher-dashboard-population/authority";
import type {
  TeacherDashboardPopulationAuthorityEvent,
  TeacherDashboardPopulationAuthorityObserver,
} from "@/lib/learner-convergence/teacher-dashboard-population/domain";
import type { TeacherDashboardLearnerPopulationEntry } from "@/lib/teacher-dashboard/domain";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type TeacherDashboardActorRole = Extract<
  ClassRosterActorRole,
  "organization_admin" | "organization_owner" | "teacher"
>;

export interface TeacherDashboardLearnerPopulationResult {
  readonly classLearnerCounts: ReadonlyMap<string, number>;
  readonly entries: readonly TeacherDashboardLearnerPopulationEntry[];
  readonly learnerCount: number;
}

export class ConsoleTeacherDashboardPopulationObserver implements TeacherDashboardPopulationAuthorityObserver {
  record(event: TeacherDashboardPopulationAuthorityEvent): void {
    console.info(
      "[teacher-dashboard-learner-authority]",
      JSON.stringify({
        canonicalPopulationCount: event.canonicalPopulationCount,
        classCount: event.classCount,
        correlation: event.correlationId,
        fallbackReason: event.fallbackReason,
        fallbackUsed: event.fallbackUsed,
        legacyPopulationCount: event.legacyPopulationCount,
        mode: event.mode,
        organization: event.organizationId,
        returnedAuthority: event.returnedAuthority,
        shadowErrorCount: event.shadowErrorCount,
        version: event.version,
      }),
    );
  }
}

function assertScopedClasses(input: {
  readonly accountId: string;
  readonly classes: readonly ClassRow[];
  readonly membershipStatus: "active" | "invited" | "removed" | "suspended";
  readonly organizationId: string;
  readonly role: TeacherDashboardActorRole;
}) {
  for (const classroom of input.classes) {
    const access = decideClassRosterAccess({
      actor: {
        accountId: input.accountId,
        activeOrganizationId: input.organizationId,
        membershipStatus: input.membershipStatus,
        role: input.role,
      },
      classroom: {
        classId: classroom.id,
        organizationId: classroom.organization_id,
        status: classroom.status,
        teacherId: classroom.teacher_id,
      },
    });
    if (!access.allowed) {
      throw new ClassroomError(
        access.reason === "MEMBERSHIP_INACTIVE" ||
          access.reason === "ROLE_NOT_ALLOWED"
          ? "forbidden"
          : "not_found",
      );
    }
  }
}

function toPopulationEntry(input: {
  readonly authority: "CANONICAL" | "LEGACY";
  readonly entry: Awaited<
    ReturnType<ReturnType<typeof createClassRosterSource>["loadCanonical"]>
  >[number];
}): TeacherDashboardLearnerPopulationEntry {
  return Object.freeze({
    classId: input.entry.classId,
    displayName:
      input.authority === "CANONICAL"
        ? (input.entry.name ?? input.entry.englishName)
        : null,
    membershipId: input.entry.membershipId,
    membershipStatus: input.entry.membershipStatus,
    studentId: input.authority === "CANONICAL" ? input.entry.studentId : null,
    studentStatus:
      input.authority === "CANONICAL" ? input.entry.studentStatus : null,
  });
}

export async function loadTeacherDashboardLearnerPopulation(input: {
  readonly accountId: string;
  readonly classes: readonly ClassRow[];
  readonly correlationId: string;
  readonly membershipStatus: "active" | "invited" | "removed" | "suspended";
  readonly organizationId: string;
  readonly role: TeacherDashboardActorRole;
}): Promise<TeacherDashboardLearnerPopulationResult> {
  assertScopedClasses(input);
  const control = getLearnerCutoverControl(
    "learner_teacher_dashboard_canonical_population",
  );
  const mode = resolveTeacherDashboardPopulationAuthorityMode({
    configuredMode:
      process.env.LEARNER_TEACHER_DASHBOARD_POPULATION_AUTHORITY_MODE,
    selectedMode: control.selectedMode,
  });
  const population = await readTeacherDashboardPopulationByAuthority({
    actorRole: input.role,
    classCount: input.classes.length,
    correlationId: input.correlationId,
    mode,
    observer: new ConsoleTeacherDashboardPopulationObserver(),
    organizationId: input.organizationId,
    source: createClassRosterSource({
      classIds: input.classes.map((classroom) => classroom.id),
      organizationId: input.organizationId,
    }),
  });
  const entries = Object.freeze(
    population.entries.map((entry) =>
      toPopulationEntry({ authority: population.authority, entry }),
    ),
  );
  const classLearnerCounts = new Map<string, number>();
  for (const entry of entries) {
    classLearnerCounts.set(
      entry.classId,
      (classLearnerCounts.get(entry.classId) ?? 0) + 1,
    );
  }
  const uniqueLearners = new Set(
    entries.map((entry) => entry.studentId ?? entry.membershipId),
  );
  return Object.freeze({
    classLearnerCounts,
    entries,
    learnerCount: uniqueLearners.size,
  });
}
