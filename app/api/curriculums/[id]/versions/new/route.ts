import {
  curriculumErrorResponse,
  curriculumSuccess,
} from "@/lib/curriculum/api";
import { revalidateCurriculumPaths } from "@/lib/curriculum/cache";
import { createNextCurriculumVersion } from "@/lib/curriculum/service";

interface CurriculumCreateVersionRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  _request: Request,
  context: CurriculumCreateVersionRouteContext,
) {
  try {
    const { id } = await context.params;
    const curriculum = await createNextCurriculumVersion(id);
    revalidateCurriculumPaths("/curriculums", `/curriculums/${curriculum.id}`);
    return Response.json(
      curriculumSuccess("已建立新的草稿版本。", {
        curriculum: { id: curriculum.id, name: curriculum.name },
        redirectTo: `/curriculums/${curriculum.id}/editor`,
      }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}
