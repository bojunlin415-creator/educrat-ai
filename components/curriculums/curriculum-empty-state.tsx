import Link from "next/link";
import { Card } from "@/components/ui/card";

export function CurriculumEmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <Card className="grid min-h-72 place-items-center p-8 text-center">
      <div>
        <span
          aria-hidden="true"
          className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-2xl"
        >
          ◫
        </span>
        <h2 className="mt-4 text-xl font-black text-emerald-950">還沒有教材</h2>
        <p className="mx-auto mt-2 max-w-md text-slate-600">
          先建立科目、年級、教材進度架構與學年度結構；本階段不會呼叫 AI
          或建立題目。
        </p>
        {canCreate ? (
          <Link
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-800 px-5 py-2.5 font-bold text-white transition-colors hover:bg-emerald-900"
            href="/curriculums/new"
          >
            建立第一份教材
          </Link>
        ) : (
          <p className="mt-5 text-sm font-bold text-amber-800">
            只有機構擁有者或管理員可以建立教材。
          </p>
        )}
      </div>
    </Card>
  );
}
