import { AssignmentError } from "@/lib/assignment/errors";
import { GET, POST } from "./route";

const serviceMocks = vi.hoisted(() => ({
  createAssignment: vi.fn(),
  listAssignments: vi.fn(),
}));

vi.mock("@/lib/assignment/service", () => serviceMocks);

const validPayload = {
  curriculumId: "10000000-0000-4000-8000-000000000001",
  curriculumVersionId: "10000000-0000-4000-8000-000000000002",
  dueAt: "2026-09-10T10:00:00.000Z",
  publishAt: "2026-09-01T10:00:00.000Z",
  studentIds: ["10000000-0000-4000-8000-000000000003"],
  title: "分數加減作業",
};

describe("AS-001 assignments collection API", () => {
  afterEach(() => vi.clearAllMocks());

  it("lists assignments through the server service boundary", async () => {
    serviceMocks.listAssignments.mockResolvedValue([{ id: "assignment-1" }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        assignments: [{ id: "assignment-1" }],
        success: true,
      }),
    );
  });

  it("creates assignments with validated JSON", async () => {
    serviceMocks.createAssignment.mockResolvedValue({ id: "assignment-1" });
    const response = await POST(
      new Request("http://localhost/api/assignments", {
        body: JSON.stringify(validPayload),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(201);
    expect(serviceMocks.createAssignment).toHaveBeenCalledWith(validPayload);
  });

  it("rejects latest or malformed curriculum version references before service", async () => {
    const response = await POST(
      new Request("http://localhost/api/assignments", {
        body: JSON.stringify({
          ...validPayload,
          curriculumVersionId: "latest",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(422);
    expect(serviceMocks.createAssignment).not.toHaveBeenCalled();
  });

  it("returns safe forbidden errors without stack traces", async () => {
    serviceMocks.createAssignment.mockRejectedValue(
      new AssignmentError("forbidden"),
    );
    const response = await POST(
      new Request("http://localhost/api/assignments", {
        body: JSON.stringify(validPayload),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("stack");
  });
});
