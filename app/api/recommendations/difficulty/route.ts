import {
  adaptiveLearningErrorResponse,
  adaptiveLearningSuccess,
  parseAdaptiveLearningQuery,
} from "@/lib/adaptive-learning/api";
import { getDifficultyRecommendations } from "@/lib/adaptive-learning/service";
import { adaptiveDifficultyQuerySchema } from "@/lib/validation/adaptive-learning";

export async function GET(request: Request) {
  const parsed = parseAdaptiveLearningQuery(
    request.url,
    adaptiveDifficultyQuerySchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const difficulty = await getDifficultyRecommendations(parsed.data);
    return Response.json(
      adaptiveLearningSuccess("自適應難度建議已載入。", { difficulty }),
    );
  } catch (error: unknown) {
    return adaptiveLearningErrorResponse(error);
  }
}
