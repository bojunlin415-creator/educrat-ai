import { CurriculumError } from "@/lib/curriculum/errors";
import { GET, PATCH } from "./route";

const serviceMocks = vi.hoisted(() => ({
  getCurriculum: vi.fn(),
  updateCurriculum: vi.fn(),
}));

vi.mock("@/lib/curriculum/service", () => serviceMocks);

const id = "10000000-0000-4000-8000-000000000009";
const validUpdate = {
  gradeId: "10000000-0000-4000-8000-000000000002",
  name: "更新後教材",
  publisherId: "10000000-0000-4000-8000-000000000003",
  schoolYear: 115,
  semester: 2,
  status: "active",
  subjectId: "10000000-0000-4000-8000-000000000001",
};

describe("curriculum detail API", () => {
  afterEach(() => vi.clearAllMocks());

  it("loads one curriculum through the server data layer", async () => {
    serviceMocks.getCurriculum.mockResolvedValue({ id, name: "教材" });
    const response = await GET(new Request(`http://localhost/${id}`), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(200);
    expect(serviceMocks.getCurriculum).toHaveBeenCalledWith(id);
  });

  it("updates approved fields and returns the detail destination", async () => {
    serviceMocks.updateCurriculum.mockResolvedValue({
      id,
      name: validUpdate.name,
    });
    const response = await PATCH(
      new Request(`http://localhost/api/curriculums/${id}`, {
        body: JSON.stringify(validUpdate),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      { params: Promise.resolve({ id }) },
    );
    const payload = (await response.json()) as { redirectTo?: string };

    expect(response.status).toBe(200);
    expect(serviceMocks.updateCurriculum).toHaveBeenCalledWith(id, validUpdate);
    expect(payload.redirectTo).toBe(`/curriculums/${id}`);
  });

  it("returns not found without leaking tenant existence", async () => {
    serviceMocks.getCurriculum.mockRejectedValue(
      new CurriculumError("not_found"),
    );
    const response = await GET(new Request(`http://localhost/${id}`), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(404);
  });

  it("rejects invalid update data before calling the service", async () => {
    const response = await PATCH(
      new Request(`http://localhost/api/curriculums/${id}`, {
        body: JSON.stringify({ ...validUpdate, semester: 3 }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(422);
    expect(serviceMocks.updateCurriculum).not.toHaveBeenCalled();
  });
});
