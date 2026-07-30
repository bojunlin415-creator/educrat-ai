import {
  adaptiveLearningErrorResponse,
  adaptiveLearningSuccess,
  parseAdaptiveLearningQuery,
} from "@/lib/adaptive-learning/api";
import { getLearningPathRecommendations } from "@/lib/adaptive-learning/service";
import { adaptivePathQuerySchema } from "@/lib/validation/adaptive-learning";

export async function GET(request: Request) {
  const parsed = parseAdaptiveLearningQuery(
    request.url,
    adaptivePathQuerySchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const paths = await getLearningPathRecommendations(parsed.data);
    return Response.json(
      adaptiveLearningSuccess("個人化學習路徑已載入。", { paths }),
    );
  } catch (error: unknown) {
    return adaptiveLearningErrorResponse(error);
  }
}
