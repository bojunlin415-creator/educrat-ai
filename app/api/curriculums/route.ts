import {
  curriculumErrorResponse,
  curriculumSuccess,
  parseCurriculumJson,
} from "@/lib/curriculum/api";
import { createCurriculum, getCurriculums } from "@/lib/curriculum/service";
import { createCurriculumSchema } from "@/lib/validation/curriculum";

export async function GET() {
  try {
    const curriculums = await getCurriculums();
    return Response.json(
      curriculumSuccess("教材列表已載入。", { curriculums }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const parsed = await parseCurriculumJson(request, createCurriculumSchema);
  if (!parsed.success) return parsed.response;

  try {
    const curriculum = await createCurriculum(parsed.data);
    return Response.json(
      curriculumSuccess("教材已建立。", {
        curriculum: { id: curriculum.id, name: curriculum.name },
        redirectTo: `/curriculums/${curriculum.id}`,
      }),
      { status: 201 },
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}
