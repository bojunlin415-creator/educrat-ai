import {
  curriculumErrorResponse,
  curriculumSuccess,
  parseCurriculumJson,
} from "@/lib/curriculum/api";
import { withLegacyReferenceCompatibility } from "@/lib/curriculum/reference-display";
import { createCurriculum, getCurriculums } from "@/lib/curriculum/service";
import { createCurriculumRequestSchema } from "@/lib/validation/curriculum";

export async function GET() {
  try {
    const curriculums = await getCurriculums();
    return Response.json(
      curriculumSuccess("教材列表已載入。", {
        curriculums: curriculums.map(withLegacyReferenceCompatibility),
      }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const parsed = await parseCurriculumJson(
    request,
    createCurriculumRequestSchema,
  );
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
