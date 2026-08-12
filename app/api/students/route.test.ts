import { StudentError } from "@/lib/student/errors";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  createStudent: vi.fn(),
  listStudents: vi.fn(),
}));
vi.mock("@/lib/student/service", () => mocks);

const payload = {
  gender: "undisclosed",
  grade: "國小三年級",
  name: "測試學生",
  studentNo: "S-100",
};

describe("Sprint 8 students API", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns descriptive 400 validation JSON", async () => {
    const response = await POST(
      new Request("http://localhost/api/students", {
        body: JSON.stringify({ name: "" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.any(String),
      details: expect.any(Object),
      success: false,
    });
  });

  it("rejects oversized JSON before calling the service", async () => {
    const response = await POST(
      new Request("http://localhost/api/students", {
        body: JSON.stringify({ ...payload, name: "學".repeat(25_000) }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(413);
    expect(mocks.createStudent).not.toHaveBeenCalled();
  });

  it("creates and lists students through the service boundary", async () => {
    mocks.createStudent.mockResolvedValue({ id: "student-1" });
    mocks.listStudents.mockResolvedValue({
      items: [],
      page: 1,
      pageSize: 20,
      total: 0,
    });
    const created = await POST(
      new Request("http://localhost/api/students", {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    const listed = await GET(new Request("http://localhost/api/students"));
    expect(created.status).toBe(201);
    expect(listed.status).toBe(200);
    expect(mocks.createStudent).toHaveBeenCalledWith(payload);
  });

  it("returns the stable invalid_input code for bad list queries", async () => {
    const response = await GET(
      new Request("http://localhost/api/students?pageSize=101"),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "invalid_input",
      success: false,
    });
  });

  it("keeps ordinary members forbidden", async () => {
    mocks.createStudent.mockRejectedValue(new StudentError("forbidden"));
    const response = await POST(
      new Request("http://localhost/api/students", {
        body: JSON.stringify(payload),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(403);
  });
});
