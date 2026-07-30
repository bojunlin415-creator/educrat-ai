import {
  learningAnalyticsErrorResponse,
  learningAnalyticsSuccess,
  parseLearningAnalyticsQuery,
} from "@/lib/learning-analytics/api";
import { getStudentTimeline } from "@/lib/learning-analytics/service";
import { studentTimelineQuerySchema } from "@/lib/validation/learning-analytics";

export async function GET(request: Request) {
  const parsed = parseLearningAnalyticsQuery(
    request.url,
    studentTimelineQuerySchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const timeline = await getStudentTimeline(parsed.data);
    return Response.json(
      learningAnalyticsSuccess("學生學習時間線已載入。", { timeline }),
    );
  } catch (error: unknown) {
    return learningAnalyticsErrorResponse(error);
  }
}
