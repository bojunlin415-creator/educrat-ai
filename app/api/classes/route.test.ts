import { ClassroomError } from "@/lib/classroom/errors";
import { GET, POST } from "./route";

const serviceMocks = vi.hoisted(() => ({
  createClass: vi.fn(),
  listClasses: vi.fn(),
}));

vi.mock("@/lib/classroom/service", () => serviceMocks);

const validPayload = {
  code: "MATH-501",
  grade: "國小五年級",
  name: "五年級數學 A 班",
  schoolYear: 115,
  semester: 1,
  subject: "數學",
  teacherId: "10000000-0000-4000-8000-000000000001",
};

describe("CL-001 classes collection API", () => {
  afterEach(() => vi.clearAllMocks());

  it("lists classes through the server service boundary", async () => {
    serviceMocks.listClasses.mockResolvedValue([{ id: "class-1" }]);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        classes: [{ id: "class-1" }],
        success: true,
      }),
    );
  });

  it("creates classes with validated JSON", async () => {
    serviceMocks.createClass.mockResolvedValue({ id: "class-1" });
    const response = await POST(
      new Request("http://localhost/api/classes", {
        body: JSON.stringify(validPayload),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(201);
    expect(serviceMocks.createClass).toHaveBeenCalledWith(validPayload);
  });

  it("rejects unsafe class codes before service", async () => {
    const response = await POST(
      new Request("http://localhost/api/classes", {
        body: JSON.stringify({ ...validPayload, code: "../MATH" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(422);
    expect(serviceMocks.createClass).not.toHaveBeenCalled();
  });

  it("returns safe forbidden errors without stack traces", async () => {
    serviceMocks.createClass.mockRejectedValue(new ClassroomError("forbidden"));
    const response = await POST(
      new Request("http://localhost/api/classes", {
        body: JSON.stringify(validPayload),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("stack");
  });
});
