import {
  learningAnalyticsErrorResponse,
  learningAnalyticsSuccess,
  parseLearningAnalyticsJson,
} from "@/lib/learning-analytics/api";
import { createLearningEvent } from "@/lib/learning-analytics/service";
import { observeLearnerShadowConsumer } from "@/lib/learner-convergence/server";
import { createLearningEventSchema } from "@/lib/validation/learning-analytics";

export async function POST(request: Request) {
  const parsed = await parseLearningAnalyticsJson(
    request,
    createLearningEventSchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const event = await createLearningEvent(parsed.data);
    await observeLearnerShadowConsumer({
      consumer: "learning_events",
      scope: { legacyAccountIds: [parsed.data.studentId] },
    });
    return Response.json(
      learningAnalyticsSuccess("學習事件已建立。", { event }),
      { status: 201 },
    );
  } catch (error: unknown) {
    return learningAnalyticsErrorResponse(error);
  }
}
