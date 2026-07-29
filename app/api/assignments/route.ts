import {
  assignmentErrorResponse,
  assignmentSuccess,
  parseAssignmentJson,
} from "@/lib/assignment/api";
import { createAssignment, listAssignments } from "@/lib/assignment/service";
import { createAssignmentSchema } from "@/lib/validation/assignment";

export async function GET() {
  try {
    const assignments = await listAssignments();
    return Response.json(
      assignmentSuccess("派發列表已載入。", { assignments }),
    );
  } catch (error: unknown) {
    return assignmentErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const parsed = await parseAssignmentJson(request, createAssignmentSchema);
  if (!parsed.success) return parsed.response;

  try {
    const assignment = await createAssignment(parsed.data);
    return Response.json(
      assignmentSuccess("教材已建立派發。", { assignment }),
      { status: 201 },
    );
  } catch (error: unknown) {
    return assignmentErrorResponse(error);
  }
}
