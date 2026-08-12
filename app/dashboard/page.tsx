import type { Metadata } from "next";
import Link from "next/link";
import { CurriculumCard } from "@/components/curriculums/curriculum-card";
import { CurriculumEmptyState } from "@/components/curriculums/curriculum-empty-state";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
import { Card } from "@/components/ui/card";
import {
  getCurriculumDashboardStats,
  getCurriculums,
} from "@/lib/curriculum/service";
import { listClasses } from "@/lib/classroom/service";
import { requireDashboardContext } from "@/lib/onboarding/guard";
import {
  canManageCurriculums,
  ORGANIZATION_ROLE_LABELS,
} from "@/lib/organization/constants";
import { listStudents } from "@/lib/student/service";

export const metadata: Metadata = { title: "工作台" };

export default async function DashboardPage() {
  const { currentOrganization, organizations, profile, user } =
    await requireDashboardContext();
  const { membership, organization } = currentOrganization;
  const curriculums = await getCurriculums();
  const curriculumStats = await getCurriculumDashboardStats(curriculums);
  const canCreateCurriculum = canManageCurriculums(membership.role);
  const canViewTeacherDashboard = [
    "organization_owner",
    "organization_admin",
    "teacher",
  ].includes(membership.role);
  const canViewParentPortal = membership.role === "guardian";
  const canManageAccess = ["organization_owner", "organization_admin"].includes(
    membership.role,
  );
  const canManageRoster = [
    "organization_owner",
    "organization_admin",
    "teacher",
  ].includes(membership.role);
  const roster = canManageRoster
    ? await Promise.all([
        listClasses().catch(() => []),
        listStudents({ page: 1, pageSize: 100, status: "all" }).catch(() => ({
          items: [],
          page: 1,
          pageSize: 100,
          total: 0,
        })),
      ])
    : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-bold text-amber-700">教材工作台</p>
          <h1 className="mt-1 text-3xl font-black text-emerald-950 sm:text-4xl">
            下午好，{profile.display_name ?? "老師"}
          </h1>
          <p className="mt-2 text-slate-600">
            已登入：{user.email ?? "已驗證帳號"}
          </p>
          <p className="mt-1 text-sm font-bold text-emerald-800">
            {organization.name} · {ORGANIZATION_ROLE_LABELS[membership.role]}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-900/15 bg-white px-5 py-2.5 font-bold text-emerald-950 transition-colors hover:bg-emerald-50"
            href="/settings/organization"
          >
            機構設定
          </Link>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-900/15 bg-white px-5 py-2.5 font-bold text-emerald-950 transition-colors hover:bg-emerald-50"
            href="/settings/profile"
          >
            個人資料
          </Link>
          {canCreateCurriculum ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-800 px-5 py-2.5 font-bold text-white hover:bg-emerald-900"
              href="/curriculums/new"
            >
              建立新教材
            </Link>
          ) : null}
          {canViewTeacherDashboard ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-5 py-2.5 font-bold text-amber-800 transition-colors hover:bg-amber-100"
              href="/dashboard/teacher"
            >
              教師儀表板
            </Link>
          ) : null}
          {canManageAccess ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-5 py-2.5 font-bold text-sky-800 transition-colors hover:bg-sky-100"
              href="/settings/access"
            >
              使用者與權限
            </Link>
          ) : null}
          {canViewParentPortal ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-5 py-2.5 font-bold text-amber-800 transition-colors hover:bg-amber-100"
              href="/dashboard/parent"
            >
              家長入口
            </Link>
          ) : null}
        </div>
      </div>
      <div className="mt-8">
        <OrganizationSwitcher
          currentOrganizationId={organization.id}
          organizations={organizations.map((item) => ({
            id: item.organization.id,
            name: item.organization.name,
            role: item.membership.role,
          }))}
        />
      </div>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-500">教材總數</p>
          <p className="mt-2 text-3xl font-black text-emerald-950">
            {curriculums.length}
          </p>
          <Link
            className="mt-3 inline-flex text-sm font-bold text-emerald-800 hover:text-emerald-950"
            href="/curriculums"
          >
            查看教材列表 →
          </Link>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-500">Chapter 數</p>
          <p className="mt-2 text-3xl font-black text-emerald-950">
            {curriculumStats.chapterCount}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-500">Lesson 數</p>
          <p className="mt-2 text-3xl font-black text-emerald-950">
            {curriculumStats.lessonCount}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-bold text-slate-500">目前範圍</p>
          <p className="mt-2 font-black text-emerald-950">章節與課次編輯</p>
          <p className="mt-2 text-sm text-slate-600">本階段不會呼叫 AI。</p>
        </Card>
      </section>
      {roster ? (
        <section aria-labelledby="roster-title" className="mt-10">
          <div className="flex items-center justify-between gap-4">
            <h2
              className="text-xl font-black text-emerald-950"
              id="roster-title"
            >
              班級與學生
            </h2>
            <div className="flex gap-4 text-sm font-bold text-emerald-800">
              <Link href="/classes">班級管理</Link>
              <Link href="/students">學生管理</Link>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <p className="text-sm font-bold text-slate-500">Total Classes</p>
              <p className="mt-2 text-3xl font-black text-emerald-950">
                {roster[0].length}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-bold text-slate-500">Total Students</p>
              <p className="mt-2 text-3xl font-black text-emerald-950">
                {roster[1].total}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-bold text-slate-500">Active Classes</p>
              <p className="mt-2 text-3xl font-black text-emerald-950">
                {roster[0].filter((item) => item.status === "active").length}
              </p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-bold text-slate-500">
                Recently Created
              </p>
              <p className="mt-2 truncate font-black text-emerald-950">
                {roster[1].items[0]?.name ?? roster[0][0]?.name ?? "尚無資料"}
              </p>
            </Card>
          </div>
        </section>
      ) : null}
      <section aria-labelledby="recent-lessons-title" className="mt-10">
        <h2
          className="text-xl font-black text-emerald-950"
          id="recent-lessons-title"
        >
          最近修改的 Lesson
        </h2>
        {curriculumStats.recentLessons.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-emerald-900/20 bg-white p-5 text-sm text-slate-600">
            尚無課次修改紀錄。
          </p>
        ) : (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {curriculumStats.recentLessons.map((lesson) => (
              <Link
                className="rounded-2xl border border-emerald-950/10 bg-white p-4 shadow-sm hover:bg-emerald-50"
                href={`/curriculums/${lesson.curriculumId}/editor`}
                key={lesson.id}
              >
                <p className="font-black text-emerald-950">{lesson.title}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {lesson.curriculumName} · {lesson.chapterTitle}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
      <section aria-labelledby="recent-title" className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-black text-emerald-950" id="recent-title">
            最近的教材
          </h2>
          {curriculums.length > 0 ? (
            <Link className="font-bold text-emerald-800" href="/curriculums">
              查看全部
            </Link>
          ) : null}
        </div>
        <div className="mt-4">
          {curriculums.length === 0 ? (
            <CurriculumEmptyState canCreate={canCreateCurriculum} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {curriculums.slice(0, 3).map((curriculum) => (
                <CurriculumCard curriculum={curriculum} key={curriculum.id} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
