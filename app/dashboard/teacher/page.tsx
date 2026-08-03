import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TeacherDashboard } from "@/components/teacher-dashboard/teacher-dashboard";
import { Alert } from "@/components/ui/alert";
import { TeacherDashboardError } from "@/lib/teacher-dashboard/errors";
import { getTeacherDashboard } from "@/lib/teacher-dashboard/service";

export const metadata: Metadata = { title: "教師儀表板" };

export default async function TeacherDashboardPage() {
  let dashboard = null;
  let dashboardError: string | null = null;
  let dashboardReferenceId: string | null = null;

  try {
    dashboard = await getTeacherDashboard();
  } catch (error: unknown) {
    if (!(error instanceof TeacherDashboardError)) throw error;
    if (error.code === "not_authenticated") {
      redirect("/login?notice=authentication_required");
    }
    dashboardError = error.message;
    dashboardReferenceId = error.referenceId ?? null;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-bold text-amber-700">TD-001</p>
          <h1 className="mt-1 text-3xl font-black text-emerald-950 sm:text-4xl">
            教師儀表板
          </h1>
          <p className="mt-2 text-slate-600">
            這裡聚合班級、學生、弱點知識點、派發狀態與推薦方向。
          </p>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-900/15 bg-white px-5 py-2.5 font-bold text-emerald-950 transition-colors hover:bg-emerald-50"
          href="/dashboard"
        >
          返回工作台
        </Link>
      </div>
      <Alert className="mt-6" title="Reporting Boundary">
        Dashboard data 由 RP-001 Reporting Service 聚合；本頁不直接查詢 Learning
        tables，也不呼叫 OpenAI。
      </Alert>
      {dashboard ? (
        <TeacherDashboard dashboard={dashboard} />
      ) : (
        <Alert className="mt-6" title="教師儀表板暫時無法載入" variant="error">
          {dashboardError ?? "目前沒有可顯示的教師儀表板資料。"}
          {dashboardReferenceId ? (
            <span className="mt-2 block font-mono text-xs">
              Reference ID: {dashboardReferenceId}
            </span>
          ) : null}
        </Alert>
      )}
    </main>
  );
}
