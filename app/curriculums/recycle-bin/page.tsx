import type { Metadata } from "next";
import Link from "next/link";
import { CurriculumLifecycleAction } from "@/components/curriculums/curriculum-lifecycle-actions";
import { CurriculumHeader } from "@/components/curriculums/curriculum-header";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { getDeletedCurriculums } from "@/lib/curriculum/service";
import { requireWorkspaceContext } from "@/lib/onboarding/guard";
import { canManageCurriculums } from "@/lib/organization/constants";

export const metadata: Metadata = { title: "教材回收桶" };
export const dynamic = "force-dynamic";

export default async function CurriculumRecycleBinPage() {
  const { currentOrganization } = await requireWorkspaceContext();
  const canManage = canManageCurriculums(currentOrganization.membership.role);
  const curriculums = canManage ? await getDeletedCurriculums() : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CurriculumHeader
        actions={
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-900/15 bg-white px-5 py-2.5 font-bold text-emerald-950 hover:bg-emerald-50"
            href="/curriculums"
          >
            返回教材列表
          </Link>
        }
        description="回收桶只顯示已移入刪除流程的教材。永久刪除前仍會檢查保留、法務與相依資料。"
        eyebrow="教材治理"
        title="教材回收桶"
      />

      {!canManage ? (
        <Alert className="mt-8" title="權限不足" variant="error">
          只有機構擁有者或管理員可以查看教材回收桶。
        </Alert>
      ) : curriculums.length === 0 ? (
        <Card className="mt-8 p-8 text-center">
          <p className="text-lg font-black text-emerald-950">
            目前沒有移入回收桶的教材
          </p>
          <p className="mt-2 text-slate-600">
            刪除草稿或已封存教材後，會在這裡顯示還原與永久刪除操作。
          </p>
        </Card>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-emerald-950/10 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-emerald-50 text-emerald-950">
              <tr>
                <th className="px-5 py-4 font-black" scope="col">
                  教材
                </th>
                <th className="px-5 py-4 font-black" scope="col">
                  科目／年級
                </th>
                <th className="px-5 py-4 font-black" scope="col">
                  刪除時間
                </th>
                <th className="px-5 py-4 font-black" scope="col">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {curriculums.map((curriculum) => (
                <tr key={curriculum.id}>
                  <td className="px-5 py-4">
                    <p className="font-black text-emerald-950">
                      {curriculum.name}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {curriculum.deletion_reason
                        ? `原因：${curriculum.deletion_reason}`
                        : "未填寫刪除原因"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {curriculum.subject.name}／{curriculum.grade.name}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {curriculum.deleted_at
                      ? new Intl.DateTimeFormat("zh-TW", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "Asia/Taipei",
                        }).format(new Date(curriculum.deleted_at))
                      : "—"}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-wrap gap-2">
                      <CurriculumLifecycleAction
                        action="restore"
                        curriculum={curriculum}
                        redirectTo="/curriculums/recycle-bin"
                        source="recycle-bin"
                      />
                      <CurriculumLifecycleAction
                        action="permanent-delete"
                        curriculum={curriculum}
                        redirectTo="/curriculums/recycle-bin"
                        source="recycle-bin"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
