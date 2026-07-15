import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CurriculumForm } from "@/components/curriculums/curriculum-form";
import { CurriculumHeader } from "@/components/curriculums/curriculum-header";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { CurriculumError } from "@/lib/curriculum/errors";
import { getCurriculum, getCurriculumOptions } from "@/lib/curriculum/service";
import { requireWorkspaceContext } from "@/lib/onboarding/guard";
import { canManageCurriculums } from "@/lib/organization/constants";

export const metadata: Metadata = { title: "編輯教材" };

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

export default async function EditCurriculumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { currentOrganization } = await requireWorkspaceContext();
  const { id } = await params;
  const curriculum = await loadCurriculum(id);
  const canEdit = canManageCurriculums(currentOrganization.membership.role);

  if (!canEdit) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <CurriculumHeader
          backHref={`/curriculums/${curriculum.id}`}
          description="你可以查看教材，但無法修改機構教材。"
          title={`編輯 ${curriculum.name}`}
        />
        <Alert className="mt-8" title="權限不足" variant="error">
          只有機構擁有者或管理員可以編輯教材。
        </Alert>
      </main>
    );
  }

  const options = await getCurriculumOptions();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <CurriculumHeader
        backHref={`/curriculums/${curriculum.id}`}
        description="更新教材基本資訊不會覆蓋既有教材版本。"
        title={`編輯 ${curriculum.name}`}
      />
      <Card className="mt-8 p-6 sm:p-8">
        <CurriculumForm
          curriculumId={curriculum.id}
          defaultValues={{
            gradeId: curriculum.grade_id,
            name: curriculum.name,
            publisherId: curriculum.publisher_id,
            schoolYear: curriculum.school_year,
            semester: curriculum.semester,
            status: curriculum.status,
            subjectId: curriculum.subject_id,
            versionRemark: "",
          }}
          mode="edit"
          options={options}
        />
      </Card>
    </main>
  );
}
