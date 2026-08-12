import "server-only";

import type { Database } from "@/lib/supabase/database.types";
import { getCurrentUser } from "@/lib/auth/session";
import { OrganizationError } from "@/lib/organization/errors";
import { requireOrganizationRole } from "@/lib/organization/service";
import { createClient } from "@/lib/supabase/server";
import { StudentError } from "@/lib/student/errors";
import {
  createStudentSchema,
  listStudentsQuerySchema,
  studentIdSchema,
  updateStudentSchema,
  type CreateStudentInput,
  type ListStudentsQuery,
  type UpdateStudentInput,
} from "@/lib/validation/student";

type StudentRow = Database["public"]["Tables"]["students"]["Row"];

function logStudentService(entry: Readonly<Record<string, unknown>>) {
  console.info("[student-service]", JSON.stringify(entry));
}

function mapOrganizationError(error: OrganizationError) {
  if (error.code === "not_authenticated")
    return new StudentError("not_authenticated");
  if (error.code === "forbidden") return new StudentError("forbidden");
  if (error.code === "organization_not_found" || error.code === "not_member") {
    return new StudentError("organization_required");
  }
  return new StudentError("service_unavailable");
}

function mapDatabaseError(error: { code?: string; message?: string } | null) {
  if (error?.code === "23505")
    return new StudentError("duplicate_student_no", { cause: error });
  if (error?.code === "42501")
    return new StudentError("forbidden", { cause: error });
  return new StudentError("service_unavailable", { cause: error ?? undefined });
}

async function requireStudentManager() {
  const actor = await getCurrentUser();
  if (!actor) throw new StudentError("not_authenticated");
  try {
    const context = await requireOrganizationRole([
      "organization_owner",
      "organization_admin",
      "teacher",
    ]);
    return { actor, ...context };
  } catch (error: unknown) {
    if (error instanceof OrganizationError) throw mapOrganizationError(error);
    throw error;
  }
}

export async function createStudent(
  input: CreateStudentInput,
): Promise<StudentRow> {
  const parsed = createStudentSchema.safeParse(input);
  if (!parsed.success) throw new StudentError("invalid_input");
  const context = await requireStudentManager();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .insert({
      birthday: parsed.data.birthday ?? null,
      english_name: parsed.data.englishName ?? null,
      gender: parsed.data.gender,
      grade: parsed.data.grade,
      name: parsed.data.name,
      organization_id: context.organization.id,
      school: parsed.data.school ?? null,
      student_no: parsed.data.studentNo,
    })
    .select("*")
    .single();
  if (error) throw mapDatabaseError(error);
  logStudentService({
    action: "create",
    actorId: context.actor.id,
    organizationId: context.organization.id,
    studentId: data.id,
  });
  return data;
}

export async function getStudent(id: string): Promise<StudentRow> {
  const parsed = studentIdSchema.safeParse(id);
  if (!parsed.success) throw new StudentError("not_found");
  const context = await requireStudentManager();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .eq("id", parsed.data)
    .eq("organization_id", context.organization.id)
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new StudentError("not_found");
  return data;
}

export async function listStudents(input: Partial<ListStudentsQuery> = {}) {
  const parsed = listStudentsQuerySchema.safeParse(input);
  if (!parsed.success) throw new StudentError("invalid_input");
  const context = await requireStudentManager();
  const supabase = await createClient();
  const from = (parsed.data.page - 1) * parsed.data.pageSize;
  const to = from + parsed.data.pageSize - 1;
  let query = supabase
    .from("students")
    .select("*", { count: "exact" })
    .eq("organization_id", context.organization.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (parsed.data.status !== "all")
    query = query.eq("status", parsed.data.status);
  if (parsed.data.search) {
    const safeSearch = parsed.data.search.replaceAll(/[%,()]/g, "");
    query = query.or(
      `name.ilike.%${safeSearch}%,student_no.ilike.%${safeSearch}%`,
    );
  }
  const { data, error, count } = await query.range(from, to);
  if (error) throw mapDatabaseError(error);
  return {
    items: data,
    page: parsed.data.page,
    pageSize: parsed.data.pageSize,
    total: count ?? 0,
  };
}

export async function listAllStudents(
  input: Partial<Pick<ListStudentsQuery, "search" | "status">> = {},
) {
  const items: StudentRow[] = [];
  let page = 1;
  let total = 0;

  do {
    const result = await listStudents({
      ...input,
      page,
      pageSize: 100,
    });
    items.push(...result.items);
    total = result.total;
    page += 1;
    if (result.items.length === 0) break;
  } while (items.length < total);

  return items;
}

export async function updateStudent(id: string, input: UpdateStudentInput) {
  const parsedId = studentIdSchema.safeParse(id);
  const parsed = updateStudentSchema.safeParse(input);
  if (!parsedId.success || !parsed.success)
    throw new StudentError("invalid_input");
  const current = await getStudent(parsedId.data);
  if (current.status === "archived") {
    throw new StudentError("invalid_student_state");
  }
  const context = await requireStudentManager();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .update({
      birthday:
        parsed.data.birthday === undefined
          ? current.birthday
          : parsed.data.birthday,
      english_name:
        parsed.data.englishName === undefined
          ? current.english_name
          : parsed.data.englishName,
      gender: parsed.data.gender ?? current.gender,
      grade: parsed.data.grade ?? current.grade,
      name: parsed.data.name ?? current.name,
      school:
        parsed.data.school === undefined ? current.school : parsed.data.school,
      student_no: parsed.data.studentNo ?? current.student_no,
    })
    .eq("id", current.id)
    .eq("organization_id", context.organization.id)
    .eq("status", "active")
    .select("*")
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new StudentError("invalid_student_state");
  return data;
}

async function changeStudentStatus(id: string, status: "active" | "archived") {
  const current = await getStudent(id);
  if (current.status === status) {
    throw new StudentError("invalid_student_state");
  }
  const context = await requireStudentManager();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .update({ status })
    .eq("id", current.id)
    .eq("organization_id", context.organization.id)
    .eq("status", current.status)
    .select("*")
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new StudentError("invalid_student_state");
  return data;
}

export const archiveStudent = (id: string) =>
  changeStudentStatus(id, "archived");
export const restoreStudent = (id: string) => changeStudentStatus(id, "active");

export async function assignStudentToClass(classId: string, studentId: string) {
  const parsedClassId = studentIdSchema.safeParse(classId);
  const parsedStudentId = studentIdSchema.safeParse(studentId);
  if (!parsedClassId.success || !parsedStudentId.success) {
    throw new StudentError("invalid_input");
  }
  const context = await requireStudentManager();
  const supabase = await createClient();
  const [
    { data: classroom, error: classError },
    { data: student, error: studentError },
  ] = await Promise.all([
    supabase
      .from("classes")
      .select("id,status,organization_id,teacher_id")
      .eq("id", parsedClassId.data)
      .eq("organization_id", context.organization.id)
      .maybeSingle(),
    supabase
      .from("students")
      .select("id,status,organization_id")
      .eq("id", parsedStudentId.data)
      .eq("organization_id", context.organization.id)
      .maybeSingle(),
  ]);
  if (classError) throw mapDatabaseError(classError);
  if (studentError) throw mapDatabaseError(studentError);
  if (
    !classroom ||
    !student ||
    classroom.status !== "active" ||
    student.status !== "active"
  ) {
    throw new StudentError("not_found");
  }
  if (
    context.membership.role === "teacher" &&
    classroom.teacher_id !== context.actor.id
  ) {
    throw new StudentError("forbidden");
  }
  const { data: existing, error: existingError } = await supabase
    .from("student_class_members")
    .select("id,status")
    .eq("class_id", classroom.id)
    .eq("student_id", student.id)
    .eq("organization_id", context.organization.id)
    .maybeSingle();
  if (existingError) throw mapDatabaseError(existingError);
  if (existing?.status === "active") {
    throw new StudentError("membership_conflict");
  }

  const joinedAt = new Date().toISOString();
  if (existing) {
    const { data, error } = await supabase
      .from("student_class_members")
      .update({ joined_at: joinedAt, left_at: null, status: "active" })
      .eq("id", existing.id)
      .eq("organization_id", context.organization.id)
      .eq("status", "left")
      .select("*")
      .maybeSingle();
    if (error) throw mapDatabaseError(error);
    if (!data) throw new StudentError("membership_conflict");
    return data;
  }

  const { data, error } = await supabase
    .from("student_class_members")
    .insert({
      class_id: classroom.id,
      joined_at: joinedAt,
      left_at: null,
      organization_id: context.organization.id,
      status: "active",
      student_id: student.id,
    })
    .select("*")
    .single();
  if (error?.code === "23505") {
    throw new StudentError("membership_conflict", { cause: error });
  }
  if (error) throw mapDatabaseError(error);
  return data;
}

export async function removeStudentFromClass(
  classId: string,
  studentId: string,
) {
  const parsedClassId = studentIdSchema.safeParse(classId);
  const parsedStudentId = studentIdSchema.safeParse(studentId);
  if (!parsedClassId.success || !parsedStudentId.success) {
    throw new StudentError("invalid_input");
  }
  const context = await requireStudentManager();
  const supabase = await createClient();
  const { data: classroom, error: classError } = await supabase
    .from("classes")
    .select("teacher_id")
    .eq("id", parsedClassId.data)
    .eq("organization_id", context.organization.id)
    .maybeSingle();
  if (classError) throw mapDatabaseError(classError);
  if (!classroom) throw new StudentError("not_found");
  if (
    context.membership.role === "teacher" &&
    classroom.teacher_id !== context.actor.id
  ) {
    throw new StudentError("forbidden");
  }
  const { data, error } = await supabase
    .from("student_class_members")
    .update({
      left_at: new Date().toISOString(),
      status: "left",
    })
    .eq("class_id", parsedClassId.data)
    .eq("student_id", parsedStudentId.data)
    .eq("organization_id", context.organization.id)
    .eq("status", "active")
    .select("*")
    .maybeSingle();
  if (error) throw mapDatabaseError(error);
  if (!data) throw new StudentError("not_found");
  return data;
}
