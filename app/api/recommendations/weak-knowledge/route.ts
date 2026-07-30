import {
  adaptiveLearningErrorResponse,
  adaptiveLearningSuccess,
  parseAdaptiveLearningQuery,
} from "@/lib/adaptive-learning/api";
import { getWeakKnowledge } from "@/lib/adaptive-learning/service";
import { adaptiveWeakKnowledgeQuerySchema } from "@/lib/validation/adaptive-learning";

export async function GET(request: Request) {
  const parsed = parseAdaptiveLearningQuery(
    request.url,
    adaptiveWeakKnowledgeQuerySchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const weakKnowledge = await getWeakKnowledge(parsed.data);
    return Response.json(
      adaptiveLearningSuccess("弱點知識點已載入。", { weakKnowledge }),
    );
  } catch (error: unknown) {
    return adaptiveLearningErrorResponse(error);
  }
}
