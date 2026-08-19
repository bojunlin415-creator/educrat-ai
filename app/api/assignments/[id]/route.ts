import {
  assignmentErrorResponse,
  assignmentSuccess,
  parseAssignmentJson,
} from "@/lib/assignment/api";
import { getAssignment, updateAssignment } from "@/lib/assignment/service";
import { observeLearnerShadowConsumer } from "@/lib/learner-convergence/server";
import { updateAssignmentSchema } from "@/lib/validation/assignment";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  try {
    const assignment = await getAssignment(id);
    await observeLearnerShadowConsumer({
      consumer: "assignment_recipients",
      scope: { assignmentIds: [assignment.id] },
    });
    return Response.json(assignmentSuccess("派發資料已載入。", { assignment }));
  } catch (error: unknown) {
    return assignmentErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const parsed = await parseAssignmentJson(request, updateAssignmentSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await context.params;
  try {
    const assignment = await updateAssignment(id, parsed.data);
    return Response.json(assignmentSuccess("派發已更新。", { assignment }));
  } catch (error: unknown) {
    return assignmentErrorResponse(error);
  }
}
