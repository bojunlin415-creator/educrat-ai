import {
  learningAnalyticsErrorResponse,
  learningAnalyticsSuccess,
  parseLearningAnalyticsQuery,
} from "@/lib/learning-analytics/api";
import { getStudentSummary } from "@/lib/learning-analytics/service";
import { observeLearnerShadowConsumer } from "@/lib/learner-convergence/server";
import { studentSummaryQuerySchema } from "@/lib/validation/learning-analytics";

export async function GET(request: Request) {
  const parsed = parseLearningAnalyticsQuery(
    request.url,
    studentSummaryQuerySchema,
  );
  if (!parsed.success) return parsed.response;

  try {
    const summary = await getStudentSummary(parsed.data);
    await observeLearnerShadowConsumer({
      consumer: "mastery_subject_projections",
      scope: {
        legacyAccountIds: parsed.data.studentId
          ? [parsed.data.studentId]
          : [
              ...new Set([
                ...(Array.isArray(summary.knowledgeMastery)
                  ? summary.knowledgeMastery.map((row) => row.student_id)
                  : []),
                ...(Array.isArray(summary.subjects)
                  ? summary.subjects.map((row) => row.student_id)
                  : []),
              ]),
            ],
      },
    });
    return Response.json(
      learningAnalyticsSuccess("學生學習摘要已載入。", { summary }),
    );
  } catch (error: unknown) {
    return learningAnalyticsErrorResponse(error);
  }
}
