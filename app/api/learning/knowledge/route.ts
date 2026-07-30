import {
  learningAnalyticsErrorResponse,
  learningAnalyticsSuccess,
  parseLearningAnalyticsQuery,
} from "@/lib/learning-analytics/api";
import { getKnowledgeSummary } from "@/lib/learning-analytics/service";
import { knowledgeSummaryQuerySchema } from "@/lib/validation/learning-analytics";

export async function GET(request: Request) {
  const parsed = parseLearningAnalyticsQuery(
    request.url,
    knowledgeSummaryQuerySchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const knowledge = await getKnowledgeSummary(parsed.data);
    return Response.json(
      learningAnalyticsSuccess("知識點學習摘要已載入。", { knowledge }),
    );
  } catch (error: unknown) {
    return learningAnalyticsErrorResponse(error);
  }
}
