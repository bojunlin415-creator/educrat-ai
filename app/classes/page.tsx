import type { Metadata } from "next";
import Link from "next/link";
import { ClassManagement } from "@/components/roster/class-management";
import { Alert } from "@/components/ui/alert";
import { listClasses } from "@/lib/classroom/service";
import { requireDashboardContext } from "@/lib/onboarding/guard";
import { listAllStudents } from "@/lib/student/service";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "班級管理" };

async function loadClassesPage(organizationId: string) {
  try {
    const supabase = await createClient();
    const [classes, students, teacherMemberships] = await Promise.all([
      listClasses(),
      listAllStudents({ status: "active" }),
      supabase
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .eq("role", "teacher"),
    ]);
    if (teacherMemberships.error) throw teacherMemberships.error;
    const memberships = teacherMemberships.data ?? [];
    const teacherIds = memberships.map((item) => item.user_id);
    const profileResult = teacherIds.length
      ? await supabase
          .from("profiles")
          .select("id,display_name")
          .in("id", teacherIds)
      : { data: [], error: null };
    if (profileResult.error) throw profileResult.error;
    const profileById = new Map(
      (profileResult.data ?? []).map((profile) => [
        profile.id,
        profile.display_name,
      ]),
    );
    const teachers = memberships.map((membership) => ({
      id: membership.user_id,
      label:
        profileById.get(membership.user_id) ??
        `未命名教師 · …${membership.user_id.slice(-6)}`,
    }));
    const studentOptions = students.map((student) => ({
      id: student.id,
      name: student.name,
      status: student.status,
      student_no: student.student_no,
    }));
    return { classes, students: studentOptions, teachers } as const;
  } catch {
    return null;
  }
}

export default async function ClassesPage() {
  const { currentOrganization } = await requireDashboardContext();
  const data = await loadClassesPage(currentOrganization.organization.id);
  if (!data) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Alert title="無法載入班級資料" variant="error">
          請確認 Development migration 已套用，或稍後再試。
        </Alert>
      </main>
    );
  }
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-bold text-amber-700">Sprint 8</p>
          <h1 className="mt-1 text-3xl font-black text-emerald-950">
            班級管理
          </h1>
          <p className="mt-2 text-slate-600">管理班級、主要教師與學生指派。</p>
        </div>
        <Link className="font-bold text-emerald-800" href="/students">
          學生管理 →
        </Link>
      </div>
      <section className="mt-8">
        <ClassManagement
          classes={data.classes}
          key={currentOrganization.organization.id}
          students={data.students}
          teachers={data.teachers}
        />
      </section>
    </main>
  );
}
