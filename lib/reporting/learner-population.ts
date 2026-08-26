import "server-only";

import { createClassRosterSource } from "@/lib/classroom/roster";
import type { Database } from "@/lib/supabase/database.types";
import { decideClassRosterAccess } from "@/lib/learner-convergence/class-roster/access";
import type { ClassRosterSource } from "@/lib/learner-convergence/class-roster/domain";
import { getLearnerCutoverControl } from "@/lib/learner-convergence/cutover/feature-controls";
import {
  readReportingPopulationByAuthority,
  resolveReportingPopulationAuthorityMode,
} from "@/lib/learner-convergence/reporting-population/authority";
import { unavailableReportingMetricCompatibility } from "@/lib/learner-convergence/reporting-population/compatibility";
import type {
  ReportingPopulationActorRole,
  ReportingPopulationAuthorityEvent,
  ReportingPopulationAuthorityObserver,
  ReportingPopulationReadResult,
} from "@/lib/learner-convergence/reporting-population/domain";
import { ReportingError } from "@/lib/reporting/errors";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];

const EMPTY_ROSTER_SOURCE: ClassRosterSource = Object.freeze({
  loadCanonical: async () => Object.freeze([]),
  loadLegacy: async () => Object.freeze([]),
});

export class ConsoleReportingPopulationObserver implements ReportingPopulationAuthorityObserver {
  record(event: ReportingPopulationAuthorityEvent): void {
    console.info(
      "[reporting-learner-authority]",
      JSON.stringify({
        canonicalLearnersWithoutLegacyMetrics:
          event.canonicalLearnersWithoutLegacyMetrics,
        canonicalPopulationCount: event.canonicalPopulationCount,
        classCount: event.classCount,
        compatibilityMappingCount: event.compatibilityMappingCount,
        correlation: event.correlationId,
        fallbackReason: event.fallbackReason,
        fallbackUsed: event.fallbackUsed,
        identityUnresolvedCount: event.identityUnresolvedCount,
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

function assertReportingClassScope(input: {
  readonly accountId: string;
  readonly classroom: ClassRow;
  readonly membershipStatus: "active" | "invited" | "removed" | "suspended";
  readonly organizationId: string;
  readonly role: ReportingPopulationActorRole;
}) {
  const decision = decideClassRosterAccess({
    actor: {
      accountId: input.accountId,
      activeOrganizationId: input.organizationId,
      membershipStatus: input.membershipStatus,
      role: input.role,
    },
    classroom: {
      classId: input.classroom.id,
      organizationId: input.classroom.organization_id,
      status: input.classroom.status,
      teacherId: input.classroom.teacher_id,
    },
  });
  if (!decision.allowed) {
    throw new ReportingError(
      decision.reason === "MEMBERSHIP_INACTIVE" ||
        decision.reason === "ROLE_NOT_ALLOWED"
        ? "forbidden"
        : "not_found",
    );
  }
}

export async function loadReportingLearnerPopulation(input: {
  readonly accountId: string;
  readonly classroom: ClassRow;
  readonly correlationId: string;
  readonly membershipStatus: "active" | "invited" | "removed" | "suspended";
  readonly organizationId: string;
  readonly role: ReportingPopulationActorRole;
}): Promise<ReportingPopulationReadResult> {
  assertReportingClassScope(input);
  const control = getLearnerCutoverControl(
    "learner_reporting_canonical_population",
  );
  const mode = resolveReportingPopulationAuthorityMode({
    configuredMode: process.env.LEARNER_REPORTING_POPULATION_AUTHORITY_MODE,
    selectedMode: control.selectedMode,
  });
  const currentPopulation = input.classroom.status === "active";
  return readReportingPopulationByAuthority({
    actorRole: input.role,
    classCount: currentPopulation ? 1 : 0,
    compatibilityResolver: {
      resolve: async (entries) =>
        unavailableReportingMetricCompatibility(entries),
    },
    correlationId: input.correlationId,
    mode,
    observer: new ConsoleReportingPopulationObserver(),
    organizationId: input.organizationId,
    source: currentPopulation
      ? createClassRosterSource({
          classIds: [input.classroom.id],
          organizationId: input.organizationId,
        })
      : EMPTY_ROSTER_SOURCE,
  });
}
