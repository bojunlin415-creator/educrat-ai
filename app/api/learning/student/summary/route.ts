import {
  learningAnalyticsErrorResponse,
  learningAnalyticsSuccess,
  parseLearningAnalyticsQuery,
} from "@/lib/learning-analytics/api";
import { getStudentSummary } from "@/lib/learning-analytics/service";
import { studentSummaryQuerySchema } from "@/lib/validation/learning-analytics";

export async function GET(request: Request) {
  const parsed = parseLearningAnalyticsQuery(
    request.url,
    studentSummaryQuerySchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const summary = await getStudentSummary(parsed.data);
    return Response.json(
      learningAnalyticsSuccess("學生學習摘要已載入。", { summary }),
    );
  } catch (error: unknown) {
    return learningAnalyticsErrorResponse(error);
  }
}
