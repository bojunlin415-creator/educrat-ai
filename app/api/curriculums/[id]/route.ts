import {
  curriculumErrorResponse,
  curriculumSuccess,
  parseCurriculumJson,
} from "@/lib/curriculum/api";
import { getCurriculum, updateCurriculum } from "@/lib/curriculum/service";
import { updateCurriculumSchema } from "@/lib/validation/curriculum";

interface CurriculumRouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: CurriculumRouteContext) {
  try {
    const { id } = await context.params;
    const curriculum = await getCurriculum(id);
    return Response.json(curriculumSuccess("教材資料已載入。", { curriculum }));
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: CurriculumRouteContext) {
  const parsed = await parseCurriculumJson(request, updateCurriculumSchema);
  if (!parsed.success) return parsed.response;

  try {
    const { id } = await context.params;
    const curriculum = await updateCurriculum(id, parsed.data);
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
