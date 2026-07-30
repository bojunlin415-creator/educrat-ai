import "server-only";

import type { User } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { getCurrentUser } from "@/lib/auth/session";
import { AssignmentError } from "@/lib/assignment/errors";
import { createClient } from "@/lib/supabase/server";
import {
  requireOrganizationMembership,
  requireOrganizationRole,
} from "@/lib/organization/service";
import { OrganizationError } from "@/lib/organization/errors";
import {
  assignStudentsSchema,
  assignmentIdSchema,
  createAssignmentSchema,
  saveSubmissionSchema,
  updateAssignmentSchema,
  type AssignStudentsInput,
  type CreateAssignmentInput,
  type SaveSubmissionInput,
  type UpdateAssignmentInput,
} from "@/lib/validation/assignment";

type AssignmentRow = Database["public"]["Tables"]["assignments"]["Row"];
type AssignmentStudentRow =
  Database["public"]["Tables"]["assignment_students"]["Row"];
type AssignmentClassRow =
  Database["public"]["Tables"]["assignment_classes"]["Row"];
type AssignmentSubmissionRow =
  Database["public"]["Tables"]["assignment_submissions"]["Row"];
type CurriculumVersionRow =
  Database["public"]["Tables"]["curriculum_versions"]["Row"];

export interface AssignmentDetail extends AssignmentRow {
  readonly classes: readonly AssignmentClassRow[];
  readonly students: readonly AssignmentStudentRow[];
}

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (!error) return new AssignmentError("service_unavailable");
  if (error.message?.includes("assignment_invalid_curriculum_version")) {
    return new AssignmentError("invalid_curriculum_version");
  }
  if (error.message?.includes("assignment_due_before_publish")) {
    return new AssignmentError("invalid_input");
  }
  if (error.message?.includes("assignment_state_locked")) {
    return new AssignmentError("invalid_assignment_state");
  }
  if (error.message?.includes("submission_locked")) {
    return new AssignmentError("submission_locked");
  }
  if (error.message?.includes("assignment_invalid_class")) {
    return new AssignmentError("invalid_input");
  }
  if (error.code === "23505") {
    return new AssignmentError("duplicate_assignment_student");
  }
  if (error.code === "22023") return new AssignmentError("invalid_input");
  if (error.code === "P0002") return new AssignmentError("not_found");
  if (error.code === "42501") {
    if (error.message?.includes("authentication_required")) {
      return new AssignmentError("not_authenticated");
    }
    if (error.message?.includes("active_organization_required")) {
      return new AssignmentError("organization_required");
    }
    return new AssignmentError("forbidden");
  }
  return new AssignmentError("service_unavailable");
}

function mapOrganizationError(error: OrganizationError): AssignmentError {
  switch (error.code) {
    case "not_authenticated":
      return new AssignmentError("not_authenticated");
    case "organization_not_found":
    case "not_member":
      return new AssignmentError("organization_required");
    case "forbidden":
      return new AssignmentError("forbidden");
    default:
      return new AssignmentError("service_unavailable");
  }
}

async function requireAssignmentActor(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AssignmentError("not_authenticated");
  return user;
}

async function requireAssignmentMembership(organizationId?: string) {
  try {
    return await requireOrganizationMembership(organizationId);
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

async function requireTeacherManager() {
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

async function requirePublishedVersion(input: {
  readonly curriculumId: string;
  readonly curriculumVersionId: string;
  readonly organizationId: string;
}): Promise<CurriculumVersionRow> {
  const supabase = await createClient();
  const { data: curriculum, error: curriculumError } = await supabase
    .from("curriculums")
    .select("*")
    .eq("id", input.curriculumId)
    .eq("organization_id", input.organizationId)
    .eq("status", "published")
    .is("deleted_at", null)
    .maybeSingle();

  if (curriculumError) throw mapDatabaseError(curriculumError);
  if (!curriculum) throw new AssignmentError("invalid_curriculum_version");

  const { data: version, error: versionError } = await supabase
    .from("curriculum_versions")
    .select("*")
    .eq("id", input.curriculumVersionId)
    .eq("curriculum_id", input.curriculumId)
    .eq("status", "published")
    .maybeSingle();

  if (versionError) throw mapDatabaseError(versionError);
  if (!version) throw new AssignmentError("invalid_curriculum_version");
  return version;
}

async function writeAssignmentAudit(input: {
  readonly action:
    | "ASSIGNMENT_ASSIGNED"
    | "ASSIGNMENT_CREATED"
    | "ASSIGNMENT_SUBMITTED"
    | "ASSIGNMENT_UPDATED";
  readonly assignmentId: string;
  readonly organizationId: string;
  readonly userId: string;
  readonly metadata?: Json;
}) {
  const supabase = await createClient();
  const { error } = await supabase.from("assignment_audit_events").insert({
    action: input.action,
    actor_id: input.userId,
    assignment_id: input.assignmentId,
    metadata: input.metadata ?? {},
    organization_id: input.organizationId,
  });
  if (error) throw mapDatabaseError(error);
}

export async function createAssignment(
  input: CreateAssignmentInput,
): Promise<AssignmentDetail> {
  const parsed = createAssignmentSchema.safeParse(input);
  if (!parsed.success) throw new AssignmentError("invalid_input");
  const context = await requireTeacherManager();
  const user = await requireAssignmentActor();
  await requirePublishedVersion({
    curriculumId: parsed.data.curriculumId,
    curriculumVersionId: parsed.data.curriculumVersionId,
    organizationId: context.organization.id,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      assigned_by: user.id,
      curriculum_id: parsed.data.curriculumId,
      curriculum_version_id: parsed.data.curriculumVersionId,
      description: parsed.data.description || null,
      due_at: parsed.data.dueAt,
      organization_id: context.organization.id,
      publish_at: parsed.data.publishAt,
      status: "scheduled",
      title: parsed.data.title,
    })
    .select("*")
    .single();
  if (error) throw mapDatabaseError(error);

  if (parsed.data.classIds?.length) {
    await assignClasses(data.id, parsed.data.classIds);
  }
  if (parsed.data.studentIds?.length) {
    await assignStudents(data.id, { studentIds: parsed.data.studentIds });
  }
  await writeAssignmentAudit({
    action: "ASSIGNMENT_CREATED",
    assignmentId: data.id,
    metadata: {
      curriculumId: data.curriculum_id,
      curriculumVersionId: data.curriculum_version_id,
    },
    organizationId: data.organization_id,
    userId: user.id,
  });
  return getAssignment(data.id);
}

export async function updateAssignment(
  id: string,
  input: UpdateAssignmentInput,
): Promise<AssignmentDetail> {
  const parsedId = assignmentIdSchema.safeParse(id);
  const parsed = updateAssignmentSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    throw new AssignmentError("invalid_input");
  }
  const context = await requireTeacherManager();
  const user = await requireAssignmentActor();
  const current = await getAssignment(parsedId.data);
  if (
    !canManageAll(context.membership.role) &&
    current.assigned_by !== user.id
  ) {
    throw new AssignmentError("forbidden");
  }
  if (current.status === "cancelled" || current.status === "closed") {
    throw new AssignmentError("invalid_assignment_state");
  }
  const publishAt = parsed.data.publishAt ?? current.publish_at;
  const dueAt = parsed.data.dueAt ?? current.due_at;
  if (Date.parse(dueAt) < Date.parse(publishAt)) {
    throw new AssignmentError("invalid_input");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("assignments")
    .update({
      description:
        parsed.data.description === undefined
          ? current.description
          : parsed.data.description || null,
      due_at: dueAt,
      publish_at: publishAt,
      status: parsed.data.status ?? current.status,
      title: parsed.data.title ?? current.title,
    })
    .eq("id", parsedId.data)
    .eq("organization_id", context.organization.id);
  if (error) throw mapDatabaseError(error);

  await writeAssignmentAudit({
    action: "ASSIGNMENT_UPDATED",
    assignmentId: parsedId.data,
    organizationId: context.organization.id,
    userId: user.id,
  });
  return getAssignment(parsedId.data);
}

export async function getAssignment(id: string): Promise<AssignmentDetail> {
  const parsedId = assignmentIdSchema.safeParse(id);
  if (!parsedId.success) throw new AssignmentError("not_found");
  const context = await requireAssignmentMembership();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("id", parsedId.data)
    .eq("organization_id", context.organization.id)
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new AssignmentError("not_found");
  const { data: students, error: studentsError } = await supabase
    .from("assignment_students")
    .select("*")
    .eq("assignment_id", data.id)
    .eq("organization_id", context.organization.id)
    .order("assigned_at", { ascending: true });
  if (studentsError) throw mapDatabaseError(studentsError);
  const { data: classes, error: classesError } = await supabase
    .from("assignment_classes")
    .select("*")
    .eq("assignment_id", data.id)
    .eq("organization_id", context.organization.id)
    .order("assigned_at", { ascending: true });
  if (classesError) throw mapDatabaseError(classesError);
  if (isStudent(context.membership.role)) {
    if (
      !students.some(
        (student) => student.student_id === context.membership.user_id,
      )
    ) {
      throw new AssignmentError("not_found");
    }
    return {
      ...data,
      classes,
      students: students.filter(
        (student) => student.student_id === context.membership.user_id,
      ),
    };
  }
  return { ...data, classes, students };
}

export async function listAssignments(): Promise<readonly AssignmentRow[]> {
  const context = await requireAssignmentMembership();
  const supabase = await createClient();
  let query = supabase
    .from("assignments")
    .select("*")
    .eq("organization_id", context.organization.id)
    .order("publish_at", { ascending: false });
  if (context.membership.role === "teacher") {
    query = query.eq("assigned_by", context.membership.user_id);
  }
  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  if (isStudent(context.membership.role)) {
    const studentAssignments = await listStudentAssignments();
    const ids = new Set(studentAssignments.map((item) => item.assignment_id));
    return data.filter((assignment) => ids.has(assignment.id));
  }
  return data;
}

export async function listStudentAssignments(): Promise<
  readonly AssignmentStudentRow[]
> {
  const context = await requireAssignmentMembership();
  const supabase = await createClient();
  let query = supabase
    .from("assignment_students")
    .select("*")
    .eq("organization_id", context.organization.id)
    .order("assigned_at", { ascending: false });
  if (isStudent(context.membership.role)) {
    query = query.eq("student_id", context.membership.user_id);
  }
  const { data, error } = await query;
  if (error) throw mapDatabaseError(error);
  return data;
}

export async function assignStudents(
  assignmentId: string,
  input: AssignStudentsInput,
): Promise<readonly AssignmentStudentRow[]> {
  const parsedId = assignmentIdSchema.safeParse(assignmentId);
  const parsed = assignStudentsSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    throw new AssignmentError("invalid_input");
  }
  const context = await requireTeacherManager();
  const user = await requireAssignmentActor();
  const assignment = await getAssignment(parsedId.data);
  if (
    !canManageAll(context.membership.role) &&
    assignment.assigned_by !== user.id
  ) {
    throw new AssignmentError("forbidden");
  }
  if (assignment.status === "cancelled" || assignment.status === "closed") {
    throw new AssignmentError("invalid_assignment_state");
  }
  if (parsed.data.classIds?.length) {
    await assignClasses(parsedId.data, parsed.data.classIds);
  }
  if (!parsed.data.studentIds?.length) {
    return getAssignment(parsedId.data).then((detail) => detail.students);
  }
  const supabase = await createClient();
  const rows = parsed.data.studentIds.map((studentId) => ({
    assignment_id: parsedId.data,
    organization_id: context.organization.id,
    student_id: studentId,
  }));
  const { data, error } = await supabase
    .from("assignment_students")
    .upsert(rows, { onConflict: "assignment_id,student_id" })
    .select("*");
  if (error) throw mapDatabaseError(error);
  await writeAssignmentAudit({
    action: "ASSIGNMENT_ASSIGNED",
    assignmentId: parsedId.data,
    metadata: { studentCount: parsed.data.studentIds.length },
    organizationId: context.organization.id,
    userId: user.id,
  });
  return data;
}

async function assignClasses(
  assignmentId: string,
  classIds: readonly string[],
): Promise<readonly AssignmentClassRow[]> {
  const context = await requireTeacherManager();
  const user = await requireAssignmentActor();
  const uniqueClassIds = [...new Set(classIds)];
  const supabase = await createClient();
  const { data: classes, error: classesError } = await supabase
    .from("classes")
    .select("*")
    .in("id", uniqueClassIds)
    .eq("organization_id", context.organization.id)
    .eq("status", "active");
  if (classesError) throw mapDatabaseError(classesError);
  if (classes.length !== uniqueClassIds.length) {
    throw new AssignmentError("invalid_input");
  }
  if (
    context.membership.role === "teacher" &&
    classes.some((classroom) => classroom.teacher_id !== user.id)
  ) {
    throw new AssignmentError("forbidden");
  }

  const classRows = classes.map((classroom) => ({
    assignment_id: assignmentId,
    class_id: classroom.id,
    organization_id: context.organization.id,
  }));
  const { data, error } = await supabase
    .from("assignment_classes")
    .upsert(classRows, { onConflict: "assignment_id,class_id" })
    .select("*");
  if (error) throw mapDatabaseError(error);

  const { data: enrollments, error: enrollmentError } = await supabase
    .from("class_enrollments")
    .select("student_id")
    .in(
      "class_id",
      classes.map((classroom) => classroom.id),
    )
    .eq("organization_id", context.organization.id)
    .eq("status", "active");
  if (enrollmentError) throw mapDatabaseError(enrollmentError);

  const studentIds = [...new Set(enrollments.map((row) => row.student_id))];
  if (studentIds.length > 0) {
    await assignStudents(assignmentId, { studentIds });
  }
  return data;
}

export async function saveSubmission(
  assignmentId: string,
  input: SaveSubmissionInput,
): Promise<AssignmentSubmissionRow> {
  const parsedId = assignmentIdSchema.safeParse(assignmentId);
  const parsed = saveSubmissionSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) {
    throw new AssignmentError("invalid_input");
  }
  const context = await requireAssignmentMembership();
  const user = await requireAssignmentActor();
  const studentId = user.id;
  if (!isStudent(context.membership.role)) {
    throw new AssignmentError("forbidden");
  }

  const assignment = await getAssignment(parsedId.data);
  const assignmentStudent = assignment.students.find(
    (student) => student.student_id === studentId,
  );
  if (!assignmentStudent) throw new AssignmentError("not_found");
  if (assignmentStudent.status === "submitted") {
    throw new AssignmentError("submission_locked");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("assignment_submissions")
    .upsert(
      {
        assignment_id: parsedId.data,
        content: parsed.data.content as Json,
        organization_id: context.organization.id,
        status: "draft",
        student_id: studentId,
      },
      { onConflict: "assignment_id,student_id" },
    )
    .select("*")
    .single();
  if (error) throw mapDatabaseError(error);

  await supabase
    .from("assignment_students")
    .update({
      opened_at: assignmentStudent.opened_at ?? new Date().toISOString(),
      status: "in_progress",
    })
    .eq("assignment_id", parsedId.data)
    .eq("student_id", studentId);
  return data;
}

export async function submitAssignment(
  assignmentId: string,
  input: SaveSubmissionInput,
): Promise<AssignmentSubmissionRow> {
  const draft = await saveSubmission(assignmentId, input);
  const context = await requireAssignmentMembership();
  const user = await requireAssignmentActor();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("assignment_submissions")
    .update({ status: "submitted", submitted_at: now })
    .eq("id", draft.id)
    .eq("student_id", user.id)
    .select("*")
    .single();
  if (error) throw mapDatabaseError(error);
  await supabase
    .from("assignment_students")
    .update({ status: "submitted", submitted_at: now })
    .eq("assignment_id", assignmentId)
    .eq("student_id", user.id);
  await writeAssignmentAudit({
    action: "ASSIGNMENT_SUBMITTED",
    assignmentId,
    organizationId: context.organization.id,
    userId: user.id,
  });
  return data;
}
