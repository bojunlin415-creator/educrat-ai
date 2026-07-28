import {
  curriculumErrorResponse,
  curriculumSuccess,
} from "@/lib/curriculum/api";
import { withLegacyReferenceCompatibility } from "@/lib/curriculum/reference-display";
import { getDeletedCurriculums } from "@/lib/curriculum/service";

export async function GET() {
  try {
    const curriculums = await getDeletedCurriculums();
    return Response.json(
      curriculumSuccess("回收桶已載入。", {
        curriculums: curriculums.map(withLegacyReferenceCompatibility),
      }),
    );
  } catch (error: unknown) {
    return curriculumErrorResponse(error);
  }
}
