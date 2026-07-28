import {
  curriculumErrorResponse,
  curriculumSuccess,
} from "@/lib/curriculum/api";
import { revalidateCurriculumPaths } from "@/lib/curriculum/cache";
import { archiveCurriculum } from "@/lib/curriculum/service";

interface CurriculumArchiveRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: Request,
  context: CurriculumArchiveRouteContext,
) {
  try {
    const { id } = await context.params;
    const curriculum = await archiveCurriculum(id);
    revalidateCurriculumPaths("/curriculums", `/curriculums/${curriculum.id}`);
    return Response.json(
      curriculumSuccess("教材已封存。", {
        curriculum: { id: curriculum.id, name: curriculum.name },
        redirectTo: `/curriculums/${curriculum.id}`,
      }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}
