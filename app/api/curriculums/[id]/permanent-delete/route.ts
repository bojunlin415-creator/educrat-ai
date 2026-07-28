import {
  curriculumErrorResponse,
  curriculumSuccess,
  parseCurriculumJson,
} from "@/lib/curriculum/api";
import { revalidateCurriculumPaths } from "@/lib/curriculum/cache";
import { permanentlyDeleteCurriculum } from "@/lib/curriculum/service";
import { curriculumPermanentDeletionSchema } from "@/lib/validation/curriculum";

interface CurriculumPermanentDeleteRouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: Request,
  context: CurriculumPermanentDeleteRouteContext,
) {
  const parsed = await parseCurriculumJson(
    request,
    curriculumPermanentDeletionSchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const { id } = await context.params;
    const deletedId = await permanentlyDeleteCurriculum(id, parsed.data);
    revalidateCurriculumPaths(
      "/curriculums",
      "/curriculums/recycle-bin",
      `/curriculums/${deletedId}`,
    );
    return Response.json(
      curriculumSuccess("教材已永久刪除。", {
        curriculum: { id: deletedId, name: "" },
        redirectTo: "/curriculums/recycle-bin",
      }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}
