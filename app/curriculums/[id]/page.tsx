import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CurriculumHeader } from "@/components/curriculums/curriculum-header";
import { Card } from "@/components/ui/card";
import { CurriculumError } from "@/lib/curriculum/errors";
import { getCurriculum } from "@/lib/curriculum/service";
import { requireWorkspaceContext } from "@/lib/onboarding/guard";
import { canManageCurriculums } from "@/lib/organization/constants";

export const metadata: Metadata = { title: "教材詳細" };

const STATUS_LABELS = {
  active: "使用中",
  archived: "已封存",
  draft: "草稿",
} as const;

async function loadCurriculum(id: string) {
  try {
    return await getCurriculum(id);
  } catch (error: unknown) {
    if (error instanceof CurriculumError && error.code === "not_found") {
      notFound();
    }
    throw error;
  }
}

export default async function CurriculumDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { currentOrganization } = await requireWorkspaceContext();
  const { id } = await params;
  const curriculum = await loadCurriculum(id);
  const canEdit = canManageCurriculums(currentOrganization.membership.role);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <CurriculumHeader
        actions={
          <div className="flex flex-wrap gap-3">
            {canEdit ? (
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-900/15 bg-white px-5 py-2.5 font-bold text-emerald-950 hover:bg-emerald-50"
                href={`/curriculums/${curriculum.id}/edit`}
              >
                編輯基本資料
              </Link>
            ) : null}
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-800 px-5 py-2.5 font-bold text-white hover:bg-emerald-900"
              href={`/curriculums/${curriculum.id}/editor`}
            >
              {canEdit ? "編輯章節與課次" : "查看章節與課次"}
            </Link>
          </div>
        }
        backHref="/curriculums"
        description={`${curriculum.subject.name} · ${curriculum.grade.name} · ${curriculum.publisher.name}進度參考`}
        title={curriculum.name}
      />

      <section className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["學年度", `${curriculum.school_year} 學年度`],
          ["學期", curriculum.semester === 1 ? "上學期" : "下學期"],
          ["狀態", STATUS_LABELS[curriculum.status]],
          ["目前版本", `v${curriculum.latestVersion}`],
        ].map(([label, value]) => (
          <Card className="p-5" key={label}>
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-1 font-black text-emerald-950">{value}</p>
          </Card>
        ))}
      </section>

      <section aria-labelledby="versions-title" className="mt-10">
        <h2 className="text-xl font-black text-emerald-950" id="versions-title">
          教材版本與章節
        </h2>
        <div className="mt-4 space-y-4">
          {curriculum.versions.map((version) => (
            <Card className="p-6" key={version.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-emerald-950">
                    版本 {version.version}
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {version.remark || "尚無版本備註"}
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                  {version.status}
                </span>
              </div>
              {version.chapters.length === 0 ? (
                <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  尚未建立章節。可前往教材編輯器建立章節與課次。
                </p>
              ) : (
                <ol className="mt-5 space-y-3">
                  {version.chapters.map((chapter) => (
                    <li className="rounded-xl bg-slate-50 p-4" key={chapter.id}>
                      <p className="font-bold text-slate-900">
                        第 {chapter.chapter_no} 章　{chapter.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {chapter.lessons.length} 個課次
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
