import { DELETE } from "./[studentId]/route";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  assignStudentToClass: vi.fn(),
  removeStudentFromClass: vi.fn(),
}));
vi.mock("@/lib/student/service", () => mocks);

const classId = "10000000-0000-4000-8000-000000000001";
const studentId = "10000000-0000-4000-8000-000000000002";

describe("Sprint 8 canonical class membership API", () => {
  afterEach(() => vi.clearAllMocks());

  it("assigns and removes a student", async () => {
    mocks.assignStudentToClass.mockResolvedValue({ id: "membership-1" });
    mocks.removeStudentFromClass.mockResolvedValue({ id: "membership-1" });
    const assigned = await POST(
      new Request("http://localhost", {
        body: JSON.stringify({ studentId }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ id: classId }) },
    );
    const removed = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: classId, studentId }),
    });
    expect(assigned.status).toBe(201);
    expect(removed.status).toBe(200);
    expect(mocks.assignStudentToClass).toHaveBeenCalledWith(classId, studentId);
    expect(mocks.removeStudentFromClass).toHaveBeenCalledWith(
      classId,
      studentId,
    );
  });
});
