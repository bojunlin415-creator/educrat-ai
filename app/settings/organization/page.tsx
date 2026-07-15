import type { Metadata } from "next";
import Link from "next/link";
import { OrganizationSettingsForm } from "@/components/forms/organization-settings-form";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { requireWorkspaceContext } from "@/lib/onboarding/guard";
import {
  canEditOrganization,
  ORGANIZATION_ROLE_LABELS,
} from "@/lib/organization/constants";

export const metadata: Metadata = { title: "機構設定" };

const statusLabels = {
  active: "正常使用",
  archived: "已封存",
  suspended: "已停用",
} as const;

export default async function OrganizationSettingsPage() {
  const { currentOrganization, profile } = await requireWorkspaceContext();
  const { membership, organization } = currentOrganization;
  const canEdit = canEditOrganization(membership.role);
  const formatter = new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: profile.timezone,
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-bold text-amber-700">機構管理</p>
          <h1 className="mt-1 text-3xl font-black text-emerald-950 sm:text-4xl">
            機構設定
          </h1>
          <p className="mt-3 leading-7 text-slate-600">
            查看目前機構的識別資料與你的成員權限。
          </p>
        </div>
        <Link
          className="font-bold text-emerald-700 hover:underline"
          href="/dashboard"
        >
          返回工作台
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="space-y-6">
          <Card className="p-6">
            <div
              aria-label="機構 Logo 尚未設定"
              className="grid size-20 place-items-center rounded-3xl bg-emerald-100 text-2xl font-black text-emerald-800"
              role="img"
            >
              機
            </div>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="font-bold text-slate-500">網址代稱</dt>
                <dd className="mt-1 font-medium break-all text-emerald-950">
                  {organization.slug}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">狀態</dt>
                <dd className="mt-1 font-medium text-emerald-950">
                  {statusLabels[organization.status]}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">目前角色</dt>
                <dd className="mt-1 font-medium text-emerald-950">
                  {ORGANIZATION_ROLE_LABELS[membership.role]}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">建立時間</dt>
                <dd className="mt-1 text-slate-700">
                  {formatter.format(new Date(organization.created_at))}
                </dd>
              </div>
              <div>
                <dt className="font-bold text-slate-500">更新時間</dt>
                <dd className="mt-1 text-slate-700">
                  {formatter.format(new Date(organization.updated_at))}
                </dd>
              </div>
            </dl>
          </Card>
          <Alert title="Logo 上傳尚未開放" variant="info">
            已預留私有 `logo_path`，但不會共用個人 Avatar bucket。獨立 Logo
            Storage 與 RLS 延後至 Sprint 10 評估實作。
          </Alert>
        </div>

        <Card className="p-6 sm:p-8">
          <OrganizationSettingsForm
            canEdit={canEdit}
            defaultValues={{
              address: organization.address ?? "",
              businessName: organization.business_name ?? "",
              email: organization.email ?? "",
              name: organization.name,
              phone: organization.phone ?? "",
              taxId: organization.tax_id ?? "",
            }}
            slug={organization.slug}
          />
        </Card>
      </div>
    </main>
  );
}
