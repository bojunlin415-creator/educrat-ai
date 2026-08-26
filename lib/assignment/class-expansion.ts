import "server-only";

import { randomUUID } from "node:crypto";
import { AssignmentError } from "@/lib/assignment/errors";
import { createClassRosterSource } from "@/lib/classroom/roster";
import {
  readAssignmentClassExpansionByAuthority,
  resolveAssignmentClassExpansionAuthorityMode,
} from "@/lib/learner-convergence/assignment-class-expansion/authority";
import type {
  AssignmentClassExpansionActorRole,
  AssignmentClassExpansionAuthorityEvent,
  AssignmentClassExpansionAuthorityObserver,
  AssignmentClassExpansionCandidate,
  AssignmentClassExpansionReadResult,
  AssignmentClassExpansionSource,
  AssignmentRecipientCompatibilityResolver,
} from "@/lib/learner-convergence/assignment-class-expansion/domain";
import { getLearnerCutoverControl } from "@/lib/learner-convergence/cutover/feature-controls";
import { createClient } from "@/lib/supabase/server";

export interface AssignmentClassExpansionPlan {
  readonly classIds: readonly string[];
  readonly organizationId: string;
  readonly result: AssignmentClassExpansionReadResult;
}

export class ConsoleAssignmentClassExpansionObserver implements AssignmentClassExpansionAuthorityObserver {
  record(event: AssignmentClassExpansionAuthorityEvent): void {
    console.info(
      "[assignment-class-expansion-authority]",
      JSON.stringify({
        assignment: event.assignmentId,
        canonicalCandidateCount: event.canonicalCandidateCount,
        classCount: event.classCount,
        compatibilityMappedCount: event.compatibilityMappedCount,
        correlation: event.correlationId,
        expectedAccountlessCandidateCount:
          event.expectedAccountlessCandidateCount,
        fallbackUsed: event.fallbackUsed,
        identityUnresolvedCount: event.identityUnresolvedCount,
        legacyCandidateCount: event.legacyCandidateCount,
        mode: event.mode,
        organization: event.organizationId,
        returnedAuthority: event.returnedAuthority,
        shadowErrorCount: event.shadowErrorCount,
        version: event.version,
      }),
    );
  }
}

const UNAVAILABLE_RECIPIENT_COMPATIBILITY: AssignmentRecipientCompatibilityResolver =
  Object.freeze({
    resolve: async () =>
      Object.freeze({
        expectedAccountlessStudentIds: Object.freeze([]),
        references: Object.freeze([]),
      }),
  });

function createAssignmentExpansionSource(input: {
  readonly classIds: readonly string[];
  readonly organizationId: string;
}): AssignmentClassExpansionSource {
  const roster = createClassRosterSource(input);
  return Object.freeze({
    async loadCanonical() {
      const entries = await roster.loadCanonical();
      return Object.freeze(
        entries.map((entry): AssignmentClassExpansionCandidate => {
          if (!entry.studentId || entry.studentStatus !== "active") {
            throw new Error("assignment_canonical_candidate_invalid");
          }
          return Object.freeze({
            canonicalStudentId: entry.studentId,
            classId: entry.classId,
            legacyRecipientId: null,
            membershipId: entry.membershipId,
            organizationId: entry.organizationId,
            source: "CANONICAL",
          });
        }),
      );
    },
    async loadLegacy() {
      if (input.classIds.length === 0) return Object.freeze([]);
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("class_enrollments")
        .select("id,organization_id,class_id,student_id")
        .eq("organization_id", input.organizationId)
        .eq("status", "active")
        .in("class_id", input.classIds)
        .order("joined_at", { ascending: true });
      if (error) {
        throw new AssignmentError("service_unavailable", { cause: error });
      }
      return Object.freeze(
        data.map((entry): AssignmentClassExpansionCandidate =>
          Object.freeze({
            canonicalStudentId: null,
            classId: entry.class_id,
            legacyRecipientId: entry.student_id,
            membershipId: entry.id,
            organizationId: entry.organization_id,
            source: "LEGACY",
          }),
        ),
      );
    },
  });
}

export async function prepareAssignmentClassExpansion(input: {
  readonly actorId: string;
  readonly actorRole: AssignmentClassExpansionActorRole;
  readonly assignmentId: string | null;
  readonly classIds: readonly string[];
  readonly organizationId: string;
}): Promise<AssignmentClassExpansionPlan> {
  const classIds = Object.freeze([...new Set(input.classIds)]);
  if (classIds.length === 0) throw new AssignmentError("invalid_input");

  const supabase = await createClient();
  const { data: classes, error } = await supabase
    .from("classes")
    .select("id,organization_id,status,teacher_id")
    .eq("organization_id", input.organizationId)
    .eq("status", "active")
    .in("id", classIds);
  if (error) {
    throw new AssignmentError("service_unavailable", { cause: error });
  }
  if (classes.length !== classIds.length) {
    throw new AssignmentError("invalid_input");
  }
  if (
    input.actorRole === "teacher" &&
    classes.some((classroom) => classroom.teacher_id !== input.actorId)
  ) {
    throw new AssignmentError("forbidden");
  }
  if (
    classes.some(
      (classroom) =>
        classroom.organization_id !== input.organizationId ||
        classroom.status !== "active",
    )
  ) {
    throw new AssignmentError("invalid_input");
  }

  const control = getLearnerCutoverControl(
    "learner_assignment_canonical_expansion",
  );
  const mode = resolveAssignmentClassExpansionAuthorityMode({
    configuredMode:
      process.env.LEARNER_ASSIGNMENT_CLASS_EXPANSION_AUTHORITY_MODE,
    selectedMode: control.selectedMode,
  });
  const result = await readAssignmentClassExpansionByAuthority({
    actorRole: input.actorRole,
    assignmentId: input.assignmentId,
    classCount: classIds.length,
    compatibilityResolver: UNAVAILABLE_RECIPIENT_COMPATIBILITY,
    correlationId: randomUUID(),
    mode,
    observer: new ConsoleAssignmentClassExpansionObserver(),
    organizationId: input.organizationId,
    source: createAssignmentExpansionSource({
      classIds,
      organizationId: input.organizationId,
    }),
  });
  return Object.freeze({
    classIds,
    organizationId: input.organizationId,
    result,
  });
}

export function requireMaterializableAssignmentRecipients(
  plan: AssignmentClassExpansionPlan,
): void {
  if (plan.result.identityUnresolvedCount > 0) {
    throw new AssignmentError("recipient_identity_unavailable");
  }
}
