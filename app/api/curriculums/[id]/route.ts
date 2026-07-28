import {
  curriculumErrorResponse,
  curriculumSuccess,
  parseCurriculumJson,
} from "@/lib/curriculum/api";
import { revalidateCurriculumPaths } from "@/lib/curriculum/cache";
import { withLegacyReferenceCompatibility } from "@/lib/curriculum/reference-display";
import {
  deleteCurriculum,
  getCurriculum,
  updateCurriculum,
} from "@/lib/curriculum/service";
import {
  curriculumDeletionSchema,
  updateCurriculumRequestSchema,
} from "@/lib/validation/curriculum";

interface CurriculumRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: CurriculumRouteContext) {
  try {
    const { id } = await context.params;
    const curriculum = await getCurriculum(id);
    return Response.json(
      curriculumSuccess("教材資料已載入。", {
        curriculum: withLegacyReferenceCompatibility(curriculum),
      }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: CurriculumRouteContext) {
  const parsed = await parseCurriculumJson(
    request,
    updateCurriculumRequestSchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const { id } = await context.params;
    const curriculum = await updateCurriculum(id, parsed.data);
    revalidateCurriculumPaths("/curriculums", `/curriculums/${curriculum.id}`);
    return Response.json(
      curriculumSuccess("教材資料已更新。", {
        curriculum: { id: curriculum.id, name: curriculum.name },
        redirectTo: `/curriculums/${curriculum.id}`,
      }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: CurriculumRouteContext,
) {
  const parsed = await parseCurriculumJson(request, curriculumDeletionSchema);
  if (!parsed.success) return parsed.response;

  try {
    const { id } = await context.params;
    const curriculum = await deleteCurriculum(id, parsed.data);
    revalidateCurriculumPaths(
      "/curriculums",
      "/curriculums/recycle-bin",
      `/curriculums/${curriculum.id}`,
    );
    return Response.json(
      curriculumSuccess("教材已移入回收桶。", {
        curriculum: { id: curriculum.id, name: curriculum.name },
        redirectTo: "/curriculums",
      }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}
