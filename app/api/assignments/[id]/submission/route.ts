import {
  assignmentErrorResponse,
  assignmentSuccess,
  parseAssignmentJson,
} from "@/lib/assignment/api";
import { saveSubmission, submitAssignment } from "@/lib/assignment/service";
import { observeLearnerShadowConsumer } from "@/lib/learner-convergence/server";
import { saveSubmissionSchema } from "@/lib/validation/assignment";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  const parsed = await parseAssignmentJson(request, saveSubmissionSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await context.params;
  try {
    const submission = await saveSubmission(id, parsed.data);
    await observeLearnerShadowConsumer({
      consumer: "submission_self_resolution",
      scope: {
        assignmentIds: [submission.assignment_id],
        legacyAccountIds: [submission.student_id],
      },
    });
    return Response.json(assignmentSuccess("作答進度已儲存。", { submission }));
  } catch (error: unknown) {
    return assignmentErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const parsed = await parseAssignmentJson(request, saveSubmissionSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await context.params;
  try {
    const submission = await submitAssignment(id, parsed.data);
    await observeLearnerShadowConsumer({
      consumer: "submission_self_resolution",
      scope: {
        assignmentIds: [submission.assignment_id],
        legacyAccountIds: [submission.student_id],
      },
    });
    return Response.json(assignmentSuccess("作答已提交。", { submission }));
  } catch (error: unknown) {
    return assignmentErrorResponse(error);
  }
}
