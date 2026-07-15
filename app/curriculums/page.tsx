import type { Metadata } from "next";
import Link from "next/link";
import { CurriculumEmptyState } from "@/components/curriculums/curriculum-empty-state";
import { CurriculumHeader } from "@/components/curriculums/curriculum-header";
import { CurriculumTable } from "@/components/curriculums/curriculum-table";
import { getCurriculums } from "@/lib/curriculum/service";
import { requireWorkspaceContext } from "@/lib/onboarding/guard";
import { canManageCurriculums } from "@/lib/organization/constants";

export const metadata: Metadata = { title: "教材列表" };

export default async function CurriculumsPage() {
  const { currentOrganization } = await requireWorkspaceContext();
  const curriculums = await getCurriculums();
  const canCreate = canManageCurriculums(currentOrganization.membership.role);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CurriculumHeader
        actions={
          canCreate ? (
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-800 px-5 py-2.5 font-bold text-white hover:bg-emerald-900"
              href="/curriculums/new"
            >
              建立教材
            </Link>
          ) : null
        }
        description={`${currentOrganization.organization.name} 的教材結構與版本紀錄。`}
        title="教材列表"
      />

      <section className="mt-8" aria-label="教材資料">
        {curriculums.length === 0 ? (
          <CurriculumEmptyState canCreate={canCreate} />
        ) : (
          <CurriculumTable curriculums={curriculums} />
        )}
      </section>
    </main>
  );
}
