import type { Metadata } from "next";
import Link from "next/link";
import { StudentManagement } from "@/components/roster/student-management";
import { Alert } from "@/components/ui/alert";
import { requireDashboardContext } from "@/lib/onboarding/guard";
import { listAllStudents } from "@/lib/student/service";

export const metadata: Metadata = { title: "學生管理" };

async function loadStudentsPage() {
  try {
    const students = await listAllStudents({ status: "all" });
    return { students } as const;
  } catch {
    return { students: null } as const;
  }
}

export default async function StudentsPage() {
  const { currentOrganization } = await requireDashboardContext();
  const { students } = await loadStudentsPage();
  if (!students) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Alert title="無法載入學生資料" variant="error">
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
            學生管理
          </h1>
          <p className="mt-2 text-slate-600">管理學生基本資料與封存狀態。</p>
        </div>
        <Link className="font-bold text-emerald-800" href="/classes">
          班級管理 →
        </Link>
      </div>
      <section className="mt-8">
        <StudentManagement
          key={currentOrganization.organization.id}
          students={students}
        />
      </section>
    </main>
  );
}
