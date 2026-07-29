import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CurriculumBreadcrumb } from "@/components/curriculums/editor/curriculum-breadcrumb";
import { CurriculumEditor } from "@/components/curriculums/editor/curriculum-editor";
import { CurriculumError } from "@/lib/curriculum/errors";
import { getCurriculum } from "@/lib/curriculum/service";
import { requireWorkspaceContext } from "@/lib/onboarding/guard";
import { canManageCurriculums } from "@/lib/organization/constants";

export const metadata: Metadata = { title: "教材章節編輯器" };

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

export default async function CurriculumEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { currentOrganization } = await requireWorkspaceContext();
  const { id } = await params;
  const curriculum = await loadCurriculum(id);
  const version = curriculum.versions[0];
  if (!version) notFound();
  const canEdit =
    curriculum.status === "draft" &&
    version.status === "draft" &&
    canManageCurriculums(currentOrganization.membership.role);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
      <CurriculumBreadcrumb
        curriculumId={curriculum.id}
        curriculumName={curriculum.name}
      />
      <div className="mt-5">
        <p className="font-bold text-amber-700">Curriculum Editor</p>
        <h1 className="mt-1 text-3xl font-black text-emerald-950 sm:text-4xl">
          {curriculum.name}
        </h1>
        <p className="mt-2 text-slate-600">
          {curriculum.subject.name} · {curriculum.grade.name} · 版本{" "}
          {version.version}
        </p>
      </div>
      <div className="mt-8">
        <CurriculumEditor
          canEdit={canEdit}
          chapters={version.chapters}
          versionId={version.id}
          versionNumber={version.version}
          versionStatus={version.status}
        />
      </div>
    </main>
  );
}
