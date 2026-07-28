import Link from "next/link";
import { CurriculumLifecycleAction } from "@/components/curriculums/curriculum-lifecycle-actions";
import type { CurriculumSummary } from "@/lib/curriculum/service";

const STATUS_LABELS: Record<CurriculumSummary["status"], string> = {
  active: "使用中",
  archived: "已封存",
  draft: "草稿",
};

export function CurriculumTable({
  canManage,
  curriculums,
}: {
  canManage: boolean;
  curriculums: CurriculumSummary[];
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-emerald-950/10 bg-white shadow-sm">
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
              進度參考
            </th>
            <th className="px-5 py-4 font-black" scope="col">
              學年度
            </th>
            <th className="px-5 py-4 font-black" scope="col">
              狀態
            </th>
            {canManage ? (
              <th className="px-5 py-4 font-black" scope="col">
                操作
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {curriculums.map((curriculum) => (
            <tr key={curriculum.id}>
              <td className="px-5 py-4">
                <Link
                  className="font-black text-emerald-900 hover:text-emerald-700"
                  href={`/curriculums/${curriculum.id}`}
                >
                  {curriculum.name}
                </Link>
                <p className="mt-1 text-xs text-slate-500">
                  v{curriculum.latestVersion}
                </p>
              </td>
              <td className="px-5 py-4 text-slate-700">
                {curriculum.subject.name}／{curriculum.grade.name}
              </td>
              <td className="px-5 py-4 text-slate-700">
                {curriculum.reference.displayName}
              </td>
              <td className="px-5 py-4 text-slate-700">
                {curriculum.school_year} ·
                {curriculum.semester === 1 ? "上學期" : "下學期"}
              </td>
              <td className="px-5 py-4 font-bold text-slate-700">
                {STATUS_LABELS[curriculum.status]}
              </td>
              {canManage ? (
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-2">
                    {curriculum.status === "active" ? (
                      <CurriculumLifecycleAction
                        action="archive"
                        curriculum={curriculum}
                        source="list"
                      />
                    ) : null}
                    {curriculum.status === "archived" ? (
                      <CurriculumLifecycleAction
                        action="restore"
                        curriculum={curriculum}
                        redirectTo="/curriculums"
                        source="list"
                      />
                    ) : null}
                    {curriculum.status !== "active" ? (
                      <CurriculumLifecycleAction
                        action="delete"
                        curriculum={curriculum}
                        redirectTo="/curriculums"
                        source="list"
                      />
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
