import "server-only";

import type { User } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getCurrentUser } from "@/lib/auth/session";
import { ClassroomError } from "@/lib/classroom/errors";
import { OrganizationError } from "@/lib/organization/errors";
import {
  requireOrganizationMembership,
  requireOrganizationRole,
} from "@/lib/organization/service";
import { createClient } from "@/lib/supabase/server";
import {
  classIdSchema,
  createClassSchema,
  enrollStudentSchema,
  updateClassSchema,
  type CreateClassInput,
  type EnrollStudentInput,
  type UpdateClassInput,
} from "@/lib/validation/classroom";

type ClassRow = Database["public"]["Tables"]["classes"]["Row"];
type ClassEnrollmentRow =
  Database["public"]["Tables"]["class_enrollments"]["Row"];

export interface ClassDetail extends ClassRow {
  readonly enrollments: readonly ClassEnrollmentRow[];
}

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return new ClassroomError("service_unavailable");
  if (error.message?.includes("class_invalid_teacher")) {
    return new ClassroomError("invalid_teacher", { cause: error });
  }
  if (error.message?.includes("class_invalid_student")) {
    return new ClassroomError("invalid_student", { cause: error });
  }
  if (error.message?.includes("class_archived")) {
    return new ClassroomError("invalid_class_state", { cause: error });
  }
  if (error.code === "23505") {
    return new ClassroomError("duplicate_code", { cause: error });
  }
  if (error.code === "22023") {
    return new ClassroomError("invalid_input", { cause: error });
  }
  if (error.code === "P0002") {
    return new ClassroomError("not_found", { cause: error });
  }
  if (error.code === "42501") {
    if (error.message?.includes("authentication_required")) {
      return new ClassroomError("not_authenticated", { cause: error });
    }
    if (error.message?.includes("active_organization_required")) {
      return new ClassroomError("organization_required", { cause: error });
    }
    return new ClassroomError("forbidden", { cause: error });
  }
  return new ClassroomError("service_unavailable", { cause: error });
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
      return new ClassroomError("service_unavailable");
  }
}

async function requireClassroomActor(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new ClassroomError("not_authenticated");
  return user;
}

async function requireClassroomMembership() {
  try {
    return await requireOrganizationMembership();
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

async function requireClassroomManager() {
  try {
    return await requireOrganizationRole([
      "organization_owner",
      "organization_admin",
      "teacher",
    ]);
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

function canManageAll(role: string): boolean {
  return role === "organization_owner" || role === "organization_admin";
}

function isStudent(role: string): boolean {
  return role === "student";
}

async function writeEnrollmentAudit(input: {
  readonly action: "ENROLLMENT_CREATED" | "ENROLLMENT_REMOVED";
  readonly classId: string;
  readonly metadata?: Json;
  readonly organizationId: string;
  readonly userId: string;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("classroom_audit_events").insert({
    action: input.action,
    actor_id: input.userId,
    class_id: input.classId,
    metadata: input.metadata ?? {},
    organization_id: input.organizationId,
  });
  if (error) throw mapDatabaseError(error);
  console.info(
    "[class-service]",
    JSON.stringify({
      action: input.action,
      actorId: input.userId,
      classId: input.classId,
      organizationId: input.organizationId,
    }),
  );
}

async function assertCanManageClass(classroom: ClassRow, actorId: string) {
  const context = await requireClassroomManager();
  if (classroom.organization_id !== context.organization.id) {
    throw new ClassroomError("not_found");
  }
  if (
    !canManageAll(context.membership.role) &&
    classroom.teacher_id !== actorId
  ) {
    throw new ClassroomError("forbidden");
  }
}

export async function createClass(
  input: CreateClassInput,
): Promise<ClassDetail> {
  const parsed = createClassSchema.safeParse(input);
  if (!parsed.success) throw new ClassroomError("invalid_input");
  const context = await requireClassroomManager();
  const user = await requireClassroomActor();
  if (
    !canManageAll(context.membership.role) &&
    parsed.data.teacherId !== user.id
  ) {
    throw new ClassroomError("forbidden");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .insert({
      code: parsed.data.code,
      description: parsed.data.description || null,
      grade: parsed.data.grade,
      name: parsed.data.name,
      organization_id: context.organization.id,
      school: parsed.data.school || null,
      school_year: parsed.data.schoolYear,
      semester: parsed.data.semester,
      subject: parsed.data.subject,
      teacher_id: parsed.data.teacherId,
    })
    .select("*")
    .single();
  if (error) throw mapDatabaseError(error);

  return getClass(data.id);
}

export async function updateClass(
  id: string,
  input: UpdateClassInput,
): Promise<ClassDetail> {
  const parsedId = classIdSchema.safeParse(id);
  const parsed = updateClassSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    throw new ClassroomError("invalid_input");
  }
  const user = await requireClassroomActor();
  const current = await getClass(parsedId.data);
  await assertCanManageClass(current, user.id);
  if (current.status === "archived") {
    throw new ClassroomError("invalid_class_state");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .update({
      code: parsed.data.code ?? current.code,
      description:
        parsed.data.description === undefined
          ? current.description
          : parsed.data.description || null,
      grade: parsed.data.grade ?? current.grade,
      name: parsed.data.name ?? current.name,
      school:
        parsed.data.school === undefined
          ? current.school
          : parsed.data.school || null,
      school_year: parsed.data.schoolYear ?? current.school_year,
      semester: parsed.data.semester ?? current.semester,
      status: parsed.data.status ?? current.status,
      subject: parsed.data.subject ?? current.subject,
      teacher_id: parsed.data.teacherId ?? current.teacher_id,
    })
    .eq("id", parsedId.data)
    .eq("organization_id", current.organization_id)
    .eq("status", current.status)
    .select("id")
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new ClassroomError("invalid_class_state");

  return getClass(parsedId.data);
}

export async function archiveClass(id: string): Promise<ClassDetail> {
  const parsedId = classIdSchema.safeParse(id);
  if (!parsedId.success) throw new ClassroomError("invalid_input");
  const user = await requireClassroomActor();
  const current = await getClass(parsedId.data);
  await assertCanManageClass(current, user.id);
  if (current.status === "archived") {
    throw new ClassroomError("invalid_class_state");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .update({ status: "archived" })
    .eq("id", parsedId.data)
    .eq("organization_id", current.organization_id)
    .eq("status", current.status)
    .select("id")
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new ClassroomError("invalid_class_state");

  return getClass(parsedId.data);
}

export async function restoreClass(id: string): Promise<ClassDetail> {
  const parsedId = classIdSchema.safeParse(id);
  if (!parsedId.success) throw new ClassroomError("invalid_input");
  const user = await requireClassroomActor();
  const current = await getClass(parsedId.data);
  await assertCanManageClass(current, user.id);
  if (current.status !== "archived") {
    throw new ClassroomError("invalid_class_state");
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .update({ status: "active" })
    .eq("id", current.id)
    .eq("organization_id", current.organization_id)
    .eq("status", "archived")
    .select("id")
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new ClassroomError("invalid_class_state");
  return getClass(current.id);
}

export async function getClass(id: string): Promise<ClassDetail> {
  const parsedId = classIdSchema.safeParse(id);
  if (!parsedId.success) throw new ClassroomError("not_found");
  const context = await requireClassroomMembership();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", parsedId.data)
    .eq("organization_id", context.organization.id)
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new ClassroomError("not_found");

  const { data: enrollments, error: enrollmentError } = await supabase
    .from("class_enrollments")
    .select("*")
    .eq("class_id", data.id)
    .eq("organization_id", context.organization.id)
    .order("joined_at", { ascending: true });
  if (enrollmentError) throw mapDatabaseError(enrollmentError);

  if (isStudent(context.membership.role)) {
    if (
      !enrollments.some(
        (enrollment) =>
          enrollment.student_id === context.membership.user_id &&
          enrollment.status === "active",
      )
    ) {
      throw new ClassroomError("not_found");
    }
    return {
      ...data,
      enrollments: enrollments.filter(
        (enrollment) => enrollment.student_id === context.membership.user_id,
      ),
    };
  }

  if (
    context.membership.role === "teacher" &&
    data.teacher_id !== context.membership.user_id
  ) {
    throw new ClassroomError("not_found");
  }

  return { ...data, enrollments };
}

export async function listClasses(): Promise<readonly ClassRow[]> {
  const context = await requireClassroomMembership();
  const supabase = await createClient();
  let query = supabase
    .from("classes")
    .select("*")
    .eq("organization_id", context.organization.id)
    .order("updated_at", { ascending: false });

  if (context.membership.role === "teacher") {
    query = query.eq("teacher_id", context.membership.user_id);
  }

  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  if (!isStudent(context.membership.role)) return data;

  const enrollments = await listStudentClasses();
  const classIds = new Set(
    enrollments.map((enrollment) => enrollment.class_id),
  );
  return data.filter((classroom) => classIds.has(classroom.id));
}

export async function listTeacherClasses(): Promise<readonly ClassRow[]> {
  const context = await requireClassroomMembership();
  if (
    context.membership.role !== "teacher" &&
    !canManageAll(context.membership.role)
  ) {
    throw new ClassroomError("forbidden");
  }
  const supabase = await createClient();
  let query = supabase
    .from("classes")
    .select("*")
    .eq("organization_id", context.organization.id)
    .order("updated_at", { ascending: false });
  if (context.membership.role === "teacher") {
    query = query.eq("teacher_id", context.membership.user_id);
  }
  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return data;
}

export async function listStudentClasses(): Promise<
  readonly ClassEnrollmentRow[]
> {
  const context = await requireClassroomMembership();
  const supabase = await createClient();
  let query = supabase
    .from("class_enrollments")
    .select("*")
    .eq("organization_id", context.organization.id)
    .eq("status", "active")
    .order("joined_at", { ascending: false });
  if (isStudent(context.membership.role)) {
    query = query.eq("student_id", context.membership.user_id);
  }
  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return data;
}

export async function enrollStudent(
  classId: string,
  input: EnrollStudentInput,
): Promise<ClassEnrollmentRow> {
  const parsedId = classIdSchema.safeParse(classId);
  const parsed = enrollStudentSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    throw new ClassroomError("invalid_input");
  }
  const user = await requireClassroomActor();
  const classroom = await getClass(parsedId.data);
  await assertCanManageClass(classroom, user.id);
  if (classroom.status !== "active") {
    throw new ClassroomError("invalid_class_state");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_enrollments")
    .upsert(
      {
        class_id: classroom.id,
        organization_id: classroom.organization_id,
        status: "active",
        student_id: parsed.data.studentId,
      },
      { onConflict: "class_id,student_id" },
    )
    .select("*")
    .single();
  if (error) throw mapDatabaseError(error);

  await writeEnrollmentAudit({
    action: "ENROLLMENT_CREATED",
    classId: classroom.id,
    metadata: { studentId: parsed.data.studentId },
    organizationId: classroom.organization_id,
    userId: user.id,
  });
  return data;
}

export async function removeStudent(
  classId: string,
  studentId: string,
): Promise<ClassEnrollmentRow> {
  const parsedId = classIdSchema.safeParse(classId);
  const parsedStudentId = enrollStudentSchema.safeParse({ studentId });
  if (!parsedId.success || !parsedStudentId.success) {
    throw new ClassroomError("invalid_input");
  }
  const user = await requireClassroomActor();
  const classroom = await getClass(parsedId.data);
  await assertCanManageClass(classroom, user.id);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("class_enrollments")
    .update({
      left_at: new Date().toISOString(),
      status: "left",
    })
    .eq("class_id", classroom.id)
    .eq("student_id", parsedStudentId.data.studentId)
    .eq("organization_id", classroom.organization_id)
    .select("*")
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new ClassroomError("not_found");

  await writeEnrollmentAudit({
    action: "ENROLLMENT_REMOVED",
    classId: classroom.id,
    metadata: { studentId: parsedStudentId.data.studentId },
    organizationId: classroom.organization_id,
    userId: user.id,
  });
  return data;
}

export const assignStudentToClass = enrollStudent;
export const removeStudentFromClass = removeStudent;
