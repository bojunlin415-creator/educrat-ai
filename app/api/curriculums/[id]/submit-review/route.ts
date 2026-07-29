import {
  curriculumErrorResponse,
  curriculumSuccess,
} from "@/lib/curriculum/api";
import { revalidateCurriculumPaths } from "@/lib/curriculum/cache";
import { submitCurriculumReview } from "@/lib/curriculum/service";

interface CurriculumSubmitReviewRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: Request,
  context: CurriculumSubmitReviewRouteContext,
) {
  try {
    const { id } = await context.params;
    const curriculum = await submitCurriculumReview(id);
    revalidateCurriculumPaths("/curriculums", `/curriculums/${curriculum.id}`);
    return Response.json(
      curriculumSuccess("教材已送出審核。", {
        curriculum: { id: curriculum.id, name: curriculum.name },
        redirectTo: `/curriculums/${curriculum.id}`,
      }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}
