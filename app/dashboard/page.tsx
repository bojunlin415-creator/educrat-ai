import type { Metadata } from "next";
import Link from "next/link";
import { CurriculumCard } from "@/components/curriculums/curriculum-card";
import { CurriculumEmptyState } from "@/components/curriculums/curriculum-empty-state";
import { OrganizationSwitcher } from "@/components/organizations/organization-switcher";
import { Card } from "@/components/ui/card";
import { getCurriculums } from "@/lib/curriculum/service";
import { requireDashboardContext } from "@/lib/onboarding/guard";
import {
  canManageCurriculums,
  ORGANIZATION_ROLE_LABELS,
} from "@/lib/organization/constants";

export const metadata: Metadata = { title: "工作台" };

export default async function DashboardPage() {
  const { currentOrganization, organizations, profile, user } =
    await requireDashboardContext();
  const { membership, organization } = currentOrganization;
  const curriculums = await getCurriculums();
  const canCreateCurriculum = canManageCurriculums(membership.role);

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
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <Card className="p-5 sm:col-span-1 lg:col-span-2">
          <p className="text-sm font-bold text-slate-500">目前範圍</p>
          <p className="mt-2 font-black text-emerald-950">教材結構與版本管理</p>
          <p className="mt-2 text-sm text-slate-600">
            Sprint 7 不會呼叫 AI、建立題庫或產生試卷。
          </p>
        </Card>
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
