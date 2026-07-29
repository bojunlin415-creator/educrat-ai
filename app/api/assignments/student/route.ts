import {
  assignmentErrorResponse,
  assignmentSuccess,
} from "@/lib/assignment/api";
import { listStudentAssignments } from "@/lib/assignment/service";

export async function GET() {
  try {
    const assignments = await listStudentAssignments();
    return Response.json(
      assignmentSuccess("學生派發列表已載入。", { assignments }),
    );
  } catch (error: unknown) {
    return assignmentErrorResponse(error);
  }
}
