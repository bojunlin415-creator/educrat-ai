import { CurriculumError } from "@/lib/curriculum/errors";
import { GET, POST } from "./route";

const serviceMocks = vi.hoisted(() => ({
  createCurriculum: vi.fn(),
  getCurriculums: vi.fn(),
}));

vi.mock("@/lib/curriculum/service", () => serviceMocks);

const validPayload = {
  gradeId: "10000000-0000-4000-8000-000000000002",
  name: "四年級數學上學期",
  publisherId: "10000000-0000-4000-8000-000000000003",
  schoolYear: 115,
  semester: 1,
  status: "draft",
  subjectId: "10000000-0000-4000-8000-000000000001",
  versionRemark: "",
};

const reference = {
  code: "teaching-progress-template-2",
  displayName: "教學進度模板 2",
  id: validPayload.publisherId,
  referenceType: "REFERENCE" as const,
};

describe("curriculums collection API", () => {
  afterEach(() => vi.clearAllMocks());

  it("lists curricula through the server data layer", async () => {
    serviceMocks.getCurriculums.mockResolvedValue([
      { id: "curriculum-1", reference },
    ]);
    const response = await GET();
    const payload = (await response.json()) as {
      curriculums?: Array<{
        publisher?: { code: string; name: string };
        publisher_id?: string;
        reference?: typeof reference;
      }>;
    };

    expect(response.status).toBe(200);
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        curriculums: expect.any(Array),
      }),
    );
    expect(payload.curriculums?.[0]).toEqual(
      expect.objectContaining({
        publisher: {
          code: "teaching-progress-template-2",
          id: validPayload.publisherId,
          name: "教學進度模板 2",
        },
        publisher_id: validPayload.publisherId,
        reference,
      }),
    );
  });

  it("creates a curriculum with validated JSON", async () => {
    serviceMocks.createCurriculum.mockResolvedValue({
      id: "10000000-0000-4000-8000-000000000009",
      name: validPayload.name,
    });
    const response = await POST(
      new Request("http://localhost/api/curriculums", {
        body: JSON.stringify(validPayload),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    const { publisherId, ...rest } = validPayload;
    expect(serviceMocks.createCurriculum).toHaveBeenCalledWith({
      ...rest,
      curriculumReferenceId: publisherId,
    });
  });

  it("rejects invalid and cross-tenant fields before calling the service", async () => {
    const response = await POST(
      new Request("http://localhost/api/curriculums", {
        body: JSON.stringify({
          ...validPayload,
          organizationId: "10000000-0000-4000-8000-000000000010",
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(422);
    expect(serviceMocks.createCurriculum).not.toHaveBeenCalled();
  });

  it("returns a safe forbidden response for teacher/reviewer writes", async () => {
    serviceMocks.createCurriculum.mockRejectedValue(
      new CurriculumError("forbidden"),
    );
    const response = await POST(
      new Request("http://localhost/api/curriculums", {
        body: JSON.stringify(validPayload),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("stack");
  });

  it("rejects unauthenticated reads through the service boundary", async () => {
    serviceMocks.getCurriculums.mockRejectedValue(
      new CurriculumError("not_authenticated"),
    );
    const response = await GET();
    expect(response.status).toBe(401);
  });
});
