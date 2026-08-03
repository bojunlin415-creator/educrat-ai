import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { requireOrganizationMembership } from "@/lib/organization/service";

export const metadata: Metadata = { title: "學生工作台" };

export default async function StudentDashboardPage() {
  const context = await requireOrganizationMembership();

  if (context.membership.role !== "student") {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Alert title="無法開啟學生工作台" variant="error">
          這個入口只開放給學生角色。請切換到學生工作區，或返回目前工作台。
        </Alert>
        <Link
          className="mt-6 inline-flex font-bold text-emerald-800"
          href="/dashboard"
        >
          返回工作台
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="font-bold text-amber-700">UX-001</p>
      <h1 className="mt-1 text-3xl font-black text-emerald-950 sm:text-4xl">
        學生工作台
      </h1>
      <Alert className="mt-6" title="學生入口已建立" variant="warning">
        學生角色已有正式登入目的地；作業作答、學習進度與學生端完整 UI
        仍需後續學生工作區 Package，現在不提前實作。
      </Alert>
    </main>
  );
}
