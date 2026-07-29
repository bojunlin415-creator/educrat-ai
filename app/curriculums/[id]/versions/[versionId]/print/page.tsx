import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CurriculumPrintButton } from "@/components/curriculums/export/curriculum-print-button";
import { Card } from "@/components/ui/card";
import { getCurriculumExportDocument } from "@/lib/curriculum/export";
import { CurriculumError } from "@/lib/curriculum/errors";
import {
  getCurriculumExportModeLabel,
  isCurriculumExportMode,
  type CurriculumExportDocument,
  type CurriculumExportMode,
} from "@/lib/curriculum-export";

export const metadata: Metadata = { title: "教材列印預覽" };

interface PrintPageProps {
  params: Promise<{ id: string; versionId: string }>;
  searchParams: Promise<{ mode?: string }>;
}

async function loadDocument(input: {
  readonly curriculumId: string;
  readonly mode: CurriculumExportMode;
  readonly versionId: string;
}) {
  try {
    return await getCurriculumExportDocument(input);
  } catch (error: unknown) {
    if (error instanceof CurriculumError && error.code === "not_found") {
      notFound();
    }
    throw error;
  }
}

function RenderWorksheet({
  document,
  includeAnswers,
}: {
  readonly document: CurriculumExportDocument;
  readonly includeAnswers: boolean;
}) {
  const questionSection = document.sections.find(
    (section) => section.kind === "questions",
  );
  return (
    <article className="mx-auto min-h-[297mm] w-[210mm] bg-white p-10 text-slate-950 print:w-auto print:p-0">
      <header className="border-b border-slate-300 pb-4">
        <p className="text-sm">
          {document.metadata.organizationName}｜{document.metadata.subject}｜
          {document.metadata.grade}｜{document.metadata.topic}
        </p>
        <h1 className="mt-2 text-2xl font-black">{document.metadata.title}</h1>
      </header>
      {!includeAnswers ? (
        <section className="mt-5 grid grid-cols-5 gap-3 text-sm">
          {["姓名", "班級", "座號", "日期", "分數"].map((label) => (
            <div className="border-b border-slate-500 pb-2" key={label}>
              {label}：
            </div>
          ))}
        </section>
      ) : null}
      <section className="mt-6 space-y-5">
        {questionSection?.questions?.map((question) => (
          <div className="break-inside-avoid" key={question.number}>
            <p className="font-bold">
              {question.number}. {question.prompt}
              {question.challenge ? "（挑戰）" : ""}
            </p>
            {includeAnswers && question.answer ? (
              <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
                <p>答案：{question.answer.value}</p>
                {question.answer.explanation ? (
                  <p className="mt-1">解析：{question.answer.explanation}</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 h-20 rounded-lg border border-dashed border-slate-300" />
            )}
          </div>
        ))}
      </section>
    </article>
  );
}

export default async function CurriculumPrintPreviewPage({
  params,
  searchParams,
}: PrintPageProps) {
  const { id, versionId } = await params;
  const { mode: rawMode } = await searchParams;
  const requestedMode = rawMode ?? null;
  const mode: CurriculumExportMode = isCurriculumExportMode(requestedMode)
    ? requestedMode
    : "worksheet";
  const document = await loadDocument({
    curriculumId: id,
    mode,
    versionId,
  });

  return (
    <main className="bg-slate-100 px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-6 flex max-w-5xl flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <p className="text-sm font-bold text-emerald-800">
            {getCurriculumExportModeLabel(mode)}
          </p>
          <h1 className="text-2xl font-black text-emerald-950">教材列印預覽</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-900/15 bg-white px-5 py-2.5 font-bold text-emerald-950 hover:bg-emerald-50"
            href={`/curriculums/${id}`}
          >
            返回教材
          </Link>
          <CurriculumPrintButton />
        </div>
      </div>

      <Card className="mx-auto max-w-5xl overflow-auto p-4 print:contents">
        {mode === "combined" ? (
          <>
            <RenderWorksheet document={document} includeAnswers={false} />
            <div className="break-after-page" />
            <RenderWorksheet document={document} includeAnswers />
          </>
        ) : (
          <RenderWorksheet
            document={document}
            includeAnswers={mode === "answer-sheet"}
          />
        )}
      </Card>
    </main>
  );
}
