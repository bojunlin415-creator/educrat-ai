import Link from "next/link";
import { Card } from "@/components/ui/card";
import type { CurriculumSummary } from "@/lib/curriculum/service";

const STATUS_LABELS: Record<CurriculumSummary["status"], string> = {
  archived: "已封存",
  draft: "草稿",
  in_review: "審核中",
  published: "已發布",
};

export function CurriculumCard({
  curriculum,
}: {
  curriculum: CurriculumSummary;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-amber-700">
            {curriculum.subject.name} · {curriculum.grade.name}
          </p>
          <h3 className="mt-1 text-lg font-black text-emerald-950">
            <Link
              className="hover:text-emerald-700"
              href={`/curriculums/${curriculum.id}`}
            >
              {curriculum.name}
            </Link>
          </h3>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
          {STATUS_LABELS[curriculum.status]}
        </span>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div>
          <dt className="text-slate-500">進度參考</dt>
          <dd className="mt-1 font-bold text-slate-900">
            {curriculum.reference.displayName}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">學年度／學期</dt>
          <dd className="mt-1 font-bold text-slate-900">
            {curriculum.school_year}／{curriculum.semester === 1 ? "上" : "下"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">目前版本</dt>
          <dd className="mt-1 font-bold text-slate-900">
            v{curriculum.latestVersion}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">最近更新</dt>
          <dd className="mt-1 font-bold text-slate-900">
            {new Intl.DateTimeFormat("zh-TW", {
              dateStyle: "medium",
              timeZone: "Asia/Taipei",
            }).format(new Date(curriculum.updated_at))}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
