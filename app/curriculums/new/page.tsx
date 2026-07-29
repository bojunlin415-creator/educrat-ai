import type { Metadata } from "next";
import { AICurriculumGeneratorPanel } from "@/components/curriculums/ai/ai-curriculum-generator";
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
  const canGenerate =
    canCreate || currentOrganization.membership.role === "teacher";

  if (!canGenerate) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <CurriculumHeader
          backHref="/curriculums"
          description="你可以查看教材，但無法新增、生成或修改機構教材。"
          title="建立教材"
        />
        <Alert className="mt-8" title="權限不足" variant="error">
          只有機構擁有者、管理員或教師可以建立 AI 教材草稿。
        </Alert>
      </main>
    );
  }

  const options = await getCurriculumOptions();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <CurriculumHeader
        backHref="/curriculums"
        description="可手動建立教材基本結構，或依課綱、能力指標、知識點與教學目標生成完全原創教材草稿。"
        title="建立教材"
      />
      <Card className="mt-8 p-6 sm:p-8">
        <AICurriculumGeneratorPanel
          initiallyOpen={!canCreate}
          options={options}
        />
      </Card>
      {canCreate ? (
        <Card className="mt-8 p-6 sm:p-8">
          <div className="mb-6">
            <p className="text-sm font-bold text-emerald-700">手動建立</p>
            <h2 className="mt-1 text-xl font-black text-emerald-950">
              建立空白教材
            </h2>
          </div>
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
      ) : null}
    </main>
  );
}
