import type { Metadata } from "next";
import { CurriculumForm } from "@/components/curriculums/curriculum-form";
import { CurriculumHeader } from "@/components/curriculums/curriculum-header";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { getCurriculumOptions } from "@/lib/curriculum/service";
import { requireWorkspaceContext } from "@/lib/onboarding/guard";
import { canManageCurriculums } from "@/lib/organization/constants";

export const metadata: Metadata = { title: "建立教材" };

export default async function NewCurriculumPage() {
  const { currentOrganization } = await requireWorkspaceContext();
  const canCreate = canManageCurriculums(currentOrganization.membership.role);

  if (!canCreate) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <CurriculumHeader
          backHref="/curriculums"
          description="你可以查看教材，但無法新增或修改機構教材。"
          title="建立教材"
        />
        <Alert className="mt-8" title="權限不足" variant="error">
          只有機構擁有者或管理員可以建立教材。
        </Alert>
      </main>
    );
  }

  const options = await getCurriculumOptions();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <CurriculumHeader
        backHref="/curriculums"
        description="建立教材基本結構與初始版本；目前不會生成文章、題目或試卷。"
        title="建立教材"
      />
      <Card className="mt-8 p-6 sm:p-8">
        <CurriculumForm
          defaultValues={{
            gradeId: "",
            name: "",
            curriculumReferenceId: "",
            schoolYear: 115,
            semester: 1,
            status: "draft",
            subjectId: "",
            versionRemark: "",
          }}
          mode="create"
          options={options}
        />
      </Card>
    </main>
  );
}
