import {
  adaptiveLearningErrorResponse,
  adaptiveLearningSuccess,
  parseAdaptiveLearningQuery,
} from "@/lib/adaptive-learning/api";
import { getStudentRecommendations } from "@/lib/adaptive-learning/service";
import { adaptiveStudentRecommendationQuerySchema } from "@/lib/validation/adaptive-learning";

export async function GET(request: Request) {
  const parsed = parseAdaptiveLearningQuery(
    request.url,
    adaptiveStudentRecommendationQuerySchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const recommendations = await getStudentRecommendations(parsed.data);
    return Response.json(
      adaptiveLearningSuccess("學生學習推薦已載入。", { recommendations }),
    );
  } catch (error: unknown) {
    return adaptiveLearningErrorResponse(error);
  }
}
