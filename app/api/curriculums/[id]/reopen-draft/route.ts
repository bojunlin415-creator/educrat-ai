import {
  curriculumErrorResponse,
  curriculumSuccess,
} from "@/lib/curriculum/api";
import { revalidateCurriculumPaths } from "@/lib/curriculum/cache";
import { reopenCurriculumDraft } from "@/lib/curriculum/service";

interface CurriculumReopenDraftRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: Request,
  context: CurriculumReopenDraftRouteContext,
) {
  try {
    const { id } = await context.params;
    const curriculum = await reopenCurriculumDraft(id);
    revalidateCurriculumPaths("/curriculums", `/curriculums/${curriculum.id}`);
    return Response.json(
      curriculumSuccess("教材已退回草稿。", {
        curriculum: { id: curriculum.id, name: curriculum.name },
        redirectTo: `/curriculums/${curriculum.id}`,
      }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}
