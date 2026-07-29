import {
  curriculumErrorResponse,
  curriculumSuccess,
} from "@/lib/curriculum/api";
import { revalidateCurriculumPaths } from "@/lib/curriculum/cache";
import { reviewCurriculum } from "@/lib/curriculum/service";

interface CurriculumReviewRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: Request,
  context: CurriculumReviewRouteContext,
) {
  try {
    const { id } = await context.params;
    const curriculum = await reviewCurriculum(id);
    revalidateCurriculumPaths("/curriculums", `/curriculums/${curriculum.id}`);
    return Response.json(
      curriculumSuccess("教材審閱已記錄。", {
        curriculum: { id: curriculum.id, name: curriculum.name },
        redirectTo: `/curriculums/${curriculum.id}`,
      }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}
