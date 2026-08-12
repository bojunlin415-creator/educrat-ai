import { ClassroomError } from "@/lib/classroom/errors";
import { POST } from "./route";

const restoreClass = vi.hoisted(() => vi.fn());
vi.mock("@/lib/classroom/service", () => ({ restoreClass }));

describe("Sprint 8 class restore API", () => {
  afterEach(() => vi.clearAllMocks());
  it("restores archived classes", async () => {
    restoreClass.mockResolvedValue({ id: "class-1", status: "active" });
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "class-1" }),
    });
    expect(response.status).toBe(200);
  });
  it("fails closed for invalid lifecycle state", async () => {
    restoreClass.mockRejectedValue(new ClassroomError("invalid_class_state"));
    const response = await POST(new Request("http://localhost"), {
      params: Promise.resolve({ id: "class-1" }),
    });
    expect(response.status).toBe(409);
  });
});
