import {
  curriculumErrorResponse,
  curriculumSuccess,
} from "@/lib/curriculum/api";
import { revalidateCurriculumPaths } from "@/lib/curriculum/cache";
import {
  restoreArchivedCurriculum,
  restoreDeletedCurriculum,
} from "@/lib/curriculum/service";

interface CurriculumRestoreRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: Request,
  context: CurriculumRestoreRouteContext,
) {
  try {
    const { id } = await context.params;
    const mode = new URL(request.url).searchParams.get("from");
    const curriculum =
      mode === "recycle-bin"
        ? await restoreDeletedCurriculum(id)
        : await restoreArchivedCurriculum(id);
    revalidateCurriculumPaths(
      "/curriculums",
      "/curriculums/recycle-bin",
      `/curriculums/${curriculum.id}`,
    );
    return Response.json(
      curriculumSuccess("教材已還原。", {
        curriculum: { id: curriculum.id, name: curriculum.name },
        redirectTo: `/curriculums/${curriculum.id}`,
      }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}
