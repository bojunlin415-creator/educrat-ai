import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "工作台" };

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="font-bold text-amber-700">教材工作台</p>
          <h1 className="mt-1 text-3xl font-black text-emerald-950 sm:text-4xl">
            下午好，老師
          </h1>
          <p className="mt-2 text-slate-600">
            已登入：{user.email ?? "已驗證帳號"}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button disabled title="後續 Sprint 開放">
            建立新教材
          </Button>
          <form action="/api/auth/logout" method="post">
            <Button type="submit" variant="secondary">
              登出
            </Button>
          </form>
        </div>
      </div>
      <Alert className="mt-8" title="功能建置中" variant="info">
        目前為空白工作台，不會產生真實教材或呼叫 AI 服務。
      </Alert>
      <section aria-labelledby="recent-title" className="mt-10">
        <h2 className="text-xl font-black text-emerald-950" id="recent-title">
          最近的教材
        </h2>
        <Card className="mt-4 grid min-h-64 place-items-center p-8 text-center">
          <div>
            <span
              aria-hidden="true"
              className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-2xl"
            >
              ✦
            </span>
            <h3 className="mt-4 text-lg font-black text-emerald-950">
              還沒有教材
            </h3>
            <p className="mt-2 max-w-sm text-slate-600">
              未來你建立的教材草稿會整齊收在這裡。
            </p>
          </div>
        </Card>
      </section>
    </main>
  );
}
