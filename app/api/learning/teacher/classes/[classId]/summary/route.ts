import {
  learningAnalyticsErrorResponse,
  learningAnalyticsSuccess,
} from "@/lib/learning-analytics/api";
import { getTeacherClassSummary } from "@/lib/learning-analytics/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ classId: string }> },
) {
  try {
    const { classId } = await context.params;
    const summary = await getTeacherClassSummary(classId);
    return Response.json(
      learningAnalyticsSuccess("班級學習摘要已載入。", { summary }),
    );
  } catch (error: unknown) {
    return learningAnalyticsErrorResponse(error);
  }
}
