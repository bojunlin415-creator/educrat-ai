import "server-only";

import { randomUUID } from "node:crypto";
import type { Database } from "@/lib/supabase/database.types";
import { ClassroomError } from "@/lib/classroom/errors";
import { decideClassRosterAccess } from "@/lib/learner-convergence/class-roster/access";
import {
  readClassRosterByAuthority,
  resolveClassRosterAuthorityMode,
} from "@/lib/learner-convergence/class-roster/authority";
import type {
  ClassRosterActorRole,
  ClassRosterAuthorityEvent,
  ClassRosterAuthorityObserver,
  ClassRosterSource,
  ClassRosterStudentProjection,
} from "@/lib/learner-convergence/class-roster/domain";
import { ClassRosterSourceError } from "@/lib/learner-convergence/class-roster/errors";
import { getLearnerCutoverControl } from "@/lib/learner-convergence/cutover/feature-controls";
import { OrganizationError } from "@/lib/organization/errors";
import { requireOrganizationRole } from "@/lib/organization/service";
import { createClient } from "@/lib/supabase/server";
import { classIdSchema } from "@/lib/validation/classroom";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];

export interface ClassRosterApiEnrollment {
  readonly class_id: string;
  readonly english_name: string | null;
  readonly grade: string | null;
  readonly id: string;
  readonly joined_at: string;
  readonly left_at: string | null;
  readonly membership_id: string;
  readonly membership_status: "active";
  readonly name: string | null;
  readonly organization_id: string;
  readonly status: "active";
  readonly student_id: string | null;
  readonly student_no: string | null;
  readonly student_status: "active" | "archived" | null;
}

export interface CanonicalClassRosterDetail extends ClassRow {
  readonly enrollments: readonly ClassRosterApiEnrollment[];
}

export interface CanonicalClassRosterRead {
  readonly authority: "CANONICAL" | "LEGACY";
  readonly class: CanonicalClassRosterDetail;
  readonly fallbackUsed: boolean;
  readonly mode:
    | "CANONICAL_ONLY"
    | "CANONICAL_PRIMARY_LEGACY_FALLBACK"
    | "LEGACY_ONLY"
    | "LEGACY_PRIMARY_CANONICAL_SHADOW";
}

function mapOrganizationError(error: OrganizationError): ClassroomError {
  switch (error.code) {
    case "not_authenticated":
      return new ClassroomError("not_authenticated");
    case "organization_not_found":
    case "not_member":
      return new ClassroomError("organization_required");
    case "forbidden":
      return new ClassroomError("forbidden");
    default:
      return new ClassroomError("service_unavailable", { cause: error });
  }
}

function databaseFailure(error: unknown): ClassroomError {
  return new ClassroomError("service_unavailable", { cause: error });
}

function canonicalDatabaseFailure(error: unknown): ClassRosterSourceError {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : null;
  const isRuntimeFailure =
    code === null ||
    code.startsWith("08") ||
    code.startsWith("53") ||
    code === "40001" ||
    code === "40P01" ||
    code === "57014" ||
    code === "57P01" ||
    code === "PGRST000" ||
    code === "PGRST001" ||
    code === "PGRST002" ||
    code === "PGRST003";
  return new ClassRosterSourceError(
    isRuntimeFailure
      ? "CANONICAL_RUNTIME_FAILURE"
      : "CANONICAL_INTEGRITY_FAILURE",
    { cause: error },
  );
}

function toApiEnrollment(
  entry: ClassRosterStudentProjection,
): ClassRosterApiEnrollment {
  return Object.freeze({
    class_id: entry.classId,
    english_name: entry.englishName,
    grade: entry.grade,
    id: entry.membershipId,
    joined_at: entry.joinedAt,
    left_at: entry.leftAt,
    membership_id: entry.membershipId,
    membership_status: entry.membershipStatus,
    name: entry.name,
    organization_id: entry.organizationId,
    status: entry.membershipStatus,
    student_id: entry.studentId,
    student_no: entry.studentNo,
    student_status: entry.studentStatus,
  });
}

class ConsoleClassRosterAuthorityObserver implements ClassRosterAuthorityObserver {
  record(event: ClassRosterAuthorityEvent): void {
    console.info(
      "[class-roster-authority]",
      JSON.stringify({
        actorRole: event.actorRole,
        canonicalCount: event.canonicalCount,
        class: event.classId,
        correlation: event.correlationId,
        fallbackReason: event.fallbackReason,
        fallbackUsed: event.fallbackUsed,
        legacyCount: event.legacyCount,
        mode: event.mode,
        organization: event.organizationId,
        returnedAuthority: event.returnedAuthority,
        shadowErrorCount: event.shadowErrorCount,
        version: event.version,
      }),
    );
  }
}

function createRosterSource(input: {
  readonly classId: string;
  readonly organizationId: string;
}): ClassRosterSource {
  return {
    async loadCanonical() {
      const supabase = await createClient();
      const { data: memberships, error: membershipError } = await supabase
        .from("student_class_members")
        .select(
          "id,organization_id,class_id,student_id,joined_at,left_at,status",
        )
        .eq("organization_id", input.organizationId)
        .eq("class_id", input.classId)
        .eq("status", "active")
        .order("joined_at", { ascending: true });
      if (membershipError) throw canonicalDatabaseFailure(membershipError);
      if (memberships.length === 0) return Object.freeze([]);

      const studentIds = [...new Set(memberships.map((row) => row.student_id))];
      const { data: students, error: studentError } = await supabase
        .from("students")
        .select("id,organization_id,student_no,name,english_name,grade,status")
        .eq("organization_id", input.organizationId)
        .eq("status", "active")
        .in("id", studentIds);
      if (studentError) throw canonicalDatabaseFailure(studentError);
      const studentsById = new Map(students.map((row) => [row.id, row]));

      return Object.freeze(
        memberships.map((membership) => {
          const student = studentsById.get(membership.student_id);
          if (
            !student ||
            student.organization_id !== input.organizationId ||
            membership.organization_id !== input.organizationId
          ) {
            throw new ClassRosterSourceError("CANONICAL_INTEGRITY_FAILURE");
          }
          return Object.freeze({
            classId: membership.class_id,
            englishName: student.english_name,
            grade: student.grade,
            joinedAt: membership.joined_at,
            leftAt: membership.left_at,
            membershipId: membership.id,
            membershipStatus: "active" as const,
            name: student.name,
            organizationId: membership.organization_id,
            studentId: student.id,
            studentNo: student.student_no,
            studentStatus: student.status,
          });
        }),
      );
    },
    async loadLegacy() {
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("class_enrollments")
        .select("id,organization_id,class_id,joined_at,left_at,status")
        .eq("organization_id", input.organizationId)
        .eq("class_id", input.classId)
        .eq("status", "active")
        .order("joined_at", { ascending: true });
      if (error) throw databaseFailure(error);
      return Object.freeze(
        data.map((membership) =>
          Object.freeze({
            classId: membership.class_id,
            englishName: null,
            grade: null,
            joinedAt: membership.joined_at,
            leftAt: membership.left_at,
            membershipId: membership.id,
            membershipStatus: "active" as const,
            name: null,
            organizationId: membership.organization_id,
            studentId: null,
            studentNo: null,
            studentStatus: null,
          }),
        ),
      );
    },
  };
}

export async function getCanonicalClassRosterDetail(
  id: string,
): Promise<CanonicalClassRosterRead> {
  const parsedId = classIdSchema.safeParse(id);
  if (!parsedId.success) throw new ClassroomError("not_found");
  let context;
  try {
    context = await requireOrganizationRole([
      "organization_owner",
      "organization_admin",
      "teacher",
    ]);
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }

  const supabase = await createClient();
  const { data: classroom, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", parsedId.data)
    .eq("organization_id", context.organization.id)
    .maybeSingle();
  if (error) throw databaseFailure(error);
  if (!classroom) throw new ClassroomError("not_found");

  const access = decideClassRosterAccess({
    actor: {
      accountId: context.membership.user_id,
      activeOrganizationId: context.organization.id,
      membershipStatus: context.membership.status,
      role: context.membership.role as ClassRosterActorRole,
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
      access.reason === "ROLE_NOT_ALLOWED" ||
        access.reason === "MEMBERSHIP_INACTIVE"
        ? "forbidden"
        : "not_found",
    );
  }

  const control = getLearnerCutoverControl(
    "learner_class_roster_canonical_read",
  );
  const mode = resolveClassRosterAuthorityMode({
    configuredMode: process.env.LEARNER_CLASS_ROSTER_AUTHORITY_MODE,
    selectedMode: control.selectedMode,
  });
  const roster = await readClassRosterByAuthority({
    actorRole: context.membership.role as ClassRosterActorRole,
    classId: classroom.id,
    correlationId: randomUUID(),
    mode,
    observer: new ConsoleClassRosterAuthorityObserver(),
    organizationId: context.organization.id,
    source: createRosterSource({
      classId: classroom.id,
      organizationId: context.organization.id,
    }),
  });

  return Object.freeze({
    authority: roster.authority,
    class: Object.freeze({
      ...classroom,
      enrollments: Object.freeze(roster.entries.map(toApiEnrollment)),
    }),
    fallbackUsed: roster.fallbackUsed,
    mode: roster.mode,
  });
}
