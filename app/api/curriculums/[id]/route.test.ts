import { CurriculumError } from "@/lib/curriculum/errors";
import { DELETE, GET, PATCH } from "./route";

const serviceMocks = vi.hoisted(() => ({
  deleteCurriculum: vi.fn(),
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
  status: "draft",
  subjectId: "10000000-0000-4000-8000-000000000001",
};

const reference = {
  code: "teaching-progress-template-2",
  displayName: "教學進度模板 2",
  id: validUpdate.publisherId,
  referenceType: "REFERENCE" as const,
};

describe("curriculum detail API", () => {
  afterEach(() => vi.clearAllMocks());

  it("loads one curriculum through the server data layer", async () => {
    serviceMocks.getCurriculum.mockResolvedValue({
      id,
      name: "教材",
      reference,
    });
    const response = await GET(new Request(`http://localhost/${id}`), {
      params: Promise.resolve({ id }),
    });
    const payload = (await response.json()) as {
      curriculum?: {
        publisher?: { code: string; name: string };
        publisher_id?: string;
        reference?: typeof reference;
      };
    };
    expect(response.status).toBe(200);
    expect(serviceMocks.getCurriculum).toHaveBeenCalledWith(id);
    expect(payload.curriculum).toEqual(
      expect.objectContaining({
        publisher: {
          code: "teaching-progress-template-2",
          id: validUpdate.publisherId,
          name: "教學進度模板 2",
        },
        publisher_id: validUpdate.publisherId,
        reference,
      }),
    );
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
    const { publisherId, ...rest } = validUpdate;
    expect(serviceMocks.updateCurriculum).toHaveBeenCalledWith(id, {
      ...rest,
      curriculumReferenceId: publisherId,
    });
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

  it("moves a curriculum to the recycle bin through DELETE", async () => {
    serviceMocks.deleteCurriculum.mockResolvedValue({
      id,
      name: "草稿教材",
    });
    const response = await DELETE(
      new Request(`http://localhost/api/curriculums/${id}`, {
        body: JSON.stringify({ reason: "不再使用" }),
        headers: { "content-type": "application/json" },
        method: "DELETE",
      }),
      { params: Promise.resolve({ id }) },
    );
    const payload = (await response.json()) as { redirectTo?: string };

    expect(response.status).toBe(200);
    expect(serviceMocks.deleteCurriculum).toHaveBeenCalledWith(id, {
      reason: "不再使用",
    });
    expect(payload.redirectTo).toBe("/curriculums");
  });

  it("rejects invalid delete payloads before calling the service", async () => {
    const response = await DELETE(
      new Request(`http://localhost/api/curriculums/${id}`, {
        body: JSON.stringify({ reason: "x".repeat(501) }),
        headers: { "content-type": "application/json" },
        method: "DELETE",
      }),
      { params: Promise.resolve({ id }) },
    );

    expect(response.status).toBe(422);
    expect(serviceMocks.deleteCurriculum).not.toHaveBeenCalled();
  });
});
