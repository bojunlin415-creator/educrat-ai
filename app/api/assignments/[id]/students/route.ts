import {
  assignmentErrorResponse,
  assignmentSuccess,
  parseAssignmentJson,
} from "@/lib/assignment/api";
import { assignStudents } from "@/lib/assignment/service";
import { assignStudentsSchema } from "@/lib/validation/assignment";

interface RouteContext {
  readonly params: Promise<{ readonly id: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const parsed = await parseAssignmentJson(request, assignStudentsSchema);
  if (!parsed.success) return parsed.response;

  const { id } = await context.params;
  try {
    const students = await assignStudents(id, parsed.data);
    return Response.json(
      assignmentSuccess("學生派發名單已更新。", { students }),
    );
  } catch (error: unknown) {
    return assignmentErrorResponse(error);
  }
}
