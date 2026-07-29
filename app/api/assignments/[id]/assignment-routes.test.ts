import { AssignmentError } from "@/lib/assignment/errors";
import { GET, PATCH } from "./route";
import { POST as assignStudentsPost } from "./students/route";
import {
  PATCH as saveSubmissionPatch,
  POST as submitSubmissionPost,
} from "./submission/route";

const serviceMocks = vi.hoisted(() => ({
  assignStudents: vi.fn(),
  getAssignment: vi.fn(),
  saveSubmission: vi.fn(),
  submitAssignment: vi.fn(),
  updateAssignment: vi.fn(),
}));

vi.mock("@/lib/assignment/service", () => serviceMocks);

const assignmentId = "10000000-0000-4000-8000-000000000004";
const routeContext = { params: Promise.resolve({ id: assignmentId }) };

describe("AS-001 assignment detail API", () => {
  afterEach(() => vi.clearAllMocks());

  it("loads one assignment by id", async () => {
    serviceMocks.getAssignment.mockResolvedValue({ id: assignmentId });
    const response = await GET(
      new Request(`http://localhost/api/assignments/${assignmentId}`),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(serviceMocks.getAssignment).toHaveBeenCalledWith(assignmentId);
  });

  it("updates assignment schedule and status through the service", async () => {
    serviceMocks.updateAssignment.mockResolvedValue({ id: assignmentId });
    const payload = {
      dueAt: "2026-09-10T10:00:00.000Z",
      publishAt: "2026-09-01T10:00:00.000Z",
      status: "active",
    };
    const response = await PATCH(
      new Request(`http://localhost/api/assignments/${assignmentId}`, {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(serviceMocks.updateAssignment).toHaveBeenCalledWith(
      assignmentId,
      payload,
    );
  });

  it("assigns students without accepting empty lists", async () => {
    const response = await assignStudentsPost(
      new Request(`http://localhost/api/assignments/${assignmentId}/students`, {
        body: JSON.stringify({ studentIds: [] }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      routeContext,
    );
    expect(response.status).toBe(422);
    expect(serviceMocks.assignStudents).not.toHaveBeenCalled();
  });

  it("saves and submits a student submission through separate server endpoints", async () => {
    serviceMocks.saveSubmission.mockResolvedValue({ id: "submission-1" });
    serviceMocks.submitAssignment.mockResolvedValue({ id: "submission-1" });
    const request = {
      body: JSON.stringify({ content: { q1: "1/2" } }),
      headers: { "content-type": "application/json" },
    };
    const saveResponse = await saveSubmissionPatch(
      new Request(
        `http://localhost/api/assignments/${assignmentId}/submission`,
        { ...request, method: "PATCH" },
      ),
      routeContext,
    );
    const submitResponse = await submitSubmissionPost(
      new Request(
        `http://localhost/api/assignments/${assignmentId}/submission`,
        { ...request, method: "POST" },
      ),
      routeContext,
    );
    expect(saveResponse.status).toBe(200);
    expect(submitResponse.status).toBe(200);
    expect(serviceMocks.saveSubmission).toHaveBeenCalledWith(assignmentId, {
      content: { q1: "1/2" },
    });
    expect(serviceMocks.submitAssignment).toHaveBeenCalledWith(assignmentId, {
      content: { q1: "1/2" },
    });
  });

  it("returns a safe locked-submission error", async () => {
    serviceMocks.submitAssignment.mockRejectedValue(
      new AssignmentError("submission_locked"),
    );
    const response = await submitSubmissionPost(
      new Request(
        `http://localhost/api/assignments/${assignmentId}/submission`,
        {
          body: JSON.stringify({ content: { q1: "1/2" } }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      ),
      routeContext,
    );
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("duplicate key");
  });
});
