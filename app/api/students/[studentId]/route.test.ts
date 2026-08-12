import { StudentError } from "@/lib/student/errors";
import { DELETE, GET, PATCH, POST } from "./route";

const mocks = vi.hoisted(() => ({
  archiveStudent: vi.fn(),
  getStudent: vi.fn(),
  restoreStudent: vi.fn(),
  updateStudent: vi.fn(),
}));
vi.mock("@/lib/student/service", () => mocks);

const studentId = "10000000-0000-4000-8000-000000000001";
const context = { params: Promise.resolve({ studentId }) };

describe("Sprint 8 student detail API", () => {
  afterEach(() => vi.clearAllMocks());

  it("gets, updates, archives, and restores through the service boundary", async () => {
    mocks.getStudent.mockResolvedValue({ id: studentId });
    mocks.updateStudent.mockResolvedValue({ id: studentId, name: "更新學生" });
    mocks.archiveStudent.mockResolvedValue({
      id: studentId,
      status: "archived",
    });
    mocks.restoreStudent.mockResolvedValue({ id: studentId, status: "active" });
    expect((await GET(new Request("http://localhost"), context)).status).toBe(
      200,
    );
    expect(
      (
        await PATCH(
          new Request("http://localhost", {
            body: JSON.stringify({ name: "更新學生" }),
            headers: { "content-type": "application/json" },
            method: "PATCH",
          }),
          context,
        )
      ).status,
    ).toBe(200);
    expect(
      (await DELETE(new Request("http://localhost"), context)).status,
    ).toBe(200);
    expect((await POST(new Request("http://localhost"), context)).status).toBe(
      200,
    );
  });

  it("returns safe cross-tenant not-found errors", async () => {
    mocks.getStudent.mockRejectedValue(new StudentError("not_found"));
    const response = await GET(new Request("http://localhost"), context);
    expect(response.status).toBe(404);
    expect(await response.text()).not.toContain("stack");
  });
});
