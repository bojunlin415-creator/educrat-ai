import type { Metadata } from "next";
import Link from "next/link";
import { ParentPortal } from "@/components/parent-portal/parent-portal";
import { Alert } from "@/components/ui/alert";
import { getParentDashboard } from "@/lib/parent-portal/service";

export const metadata: Metadata = { title: "家長入口" };

export default async function ParentDashboardPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ readonly studentId?: string }>;
}) {
  const params = await searchParams;
  const dashboard = await getParentDashboard({ studentId: params.studentId });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-bold text-amber-700">PP-001</p>
          <h1 className="mt-1 text-3xl font-black text-emerald-950 sm:text-4xl">
            家長入口
          </h1>
          <p className="mt-2 text-slate-600">
            以家長友善語言查看孩子的學習進度、作業狀態與練習建議。
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-900/15 bg-white px-5 py-2.5 font-bold text-emerald-950 transition-colors hover:bg-emerald-50"
          href="/dashboard"
        >
          返回工作台
        </Link>
      </div>
      <Alert className="mt-6" title="Privacy Boundary">
        Parent Portal 只透過已驗證 guardian-child relationship 讀取 Reporting
        Service 的家長專用摘要；不顯示原始作答、內部分數理由或其他學生資料。
      </Alert>
      <ParentPortal dashboard={dashboard} />
    </main>
  );
}
