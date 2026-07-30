import {
  learningAnalyticsErrorResponse,
  learningAnalyticsSuccess,
} from "@/lib/learning-analytics/api";
import { getWeakKnowledgeRanking } from "@/lib/learning-analytics/service";

export async function GET(
  _request: Request,
  context: { params: Promise<{ classId: string }> },
) {
  try {
    const { classId } = await context.params;
    const weakKnowledge = await getWeakKnowledgeRanking(classId);
    return Response.json(
      learningAnalyticsSuccess("班級弱點知識點已載入。", { weakKnowledge }),
    );
  } catch (error: unknown) {
    return learningAnalyticsErrorResponse(error);
  }
}
