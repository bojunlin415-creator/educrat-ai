import { CurriculumError } from "@/lib/curriculum/errors";
import { DELETE, GET, PATCH, POST } from "./route";

const serviceMocks = vi.hoisted(() => ({
  createChapter: vi.fn(),
  deleteChapter: vi.fn(),
  getChapters: vi.fn(),
  reorderChapter: vi.fn(),
  updateChapter: vi.fn(),
}));

vi.mock("@/lib/curriculum/service", () => serviceMocks);

const versionId = "10000000-0000-4000-8000-000000000001";
const curriculumId = "20000000-0000-4000-8000-000000000001";
const chapterId = "30000000-0000-4000-8000-000000000001";
const chapter = {
  chapterNo: 1,
  description: "整數概念",
  status: "draft",
  title: "整數",
};

function jsonRequest(method: string, body: unknown) {
  return new Request("http://localhost/api/chapters", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method,
  });
}

describe("chapters API", () => {
  afterEach(() => vi.clearAllMocks());

  it("lists active-tenant chapters through the data layer", async () => {
    serviceMocks.getChapters.mockResolvedValue({ chapters: [], version: {} });
    const response = await GET(
      new Request(`http://localhost/api/chapters?curriculumId=${curriculumId}`),
    );
    expect(response.status).toBe(200);
    expect(serviceMocks.getChapters).toHaveBeenCalledWith(curriculumId);
  });

  it("creates, updates, reorders, and deletes validated chapters", async () => {
    serviceMocks.createChapter.mockResolvedValue(chapterId);
    serviceMocks.updateChapter.mockResolvedValue(chapterId);
    serviceMocks.reorderChapter.mockResolvedValue([chapterId]);
    serviceMocks.deleteChapter.mockResolvedValue(chapterId);

    expect(
      (await POST(jsonRequest("POST", { ...chapter, versionId }))).status,
    ).toBe(201);
    expect(
      (
        await PATCH(
          jsonRequest("PATCH", {
            action: "update",
            chapterId,
            ...chapter,
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await PATCH(
          jsonRequest("PATCH", {
            action: "reorder",
            orderedIds: [chapterId],
            versionId,
          }),
        )
      ).status,
    ).toBe(200);
    expect((await DELETE(jsonRequest("DELETE", { chapterId }))).status).toBe(
      200,
    );
  });

  it("rejects malformed and cross-tenant fields before service calls", async () => {
    const response = await POST(
      jsonRequest("POST", {
        ...chapter,
        organizationId: curriculumId,
        versionId,
      }),
    );
    expect(response.status).toBe(422);
    expect(serviceMocks.createChapter).not.toHaveBeenCalled();
  });

  it("returns safe auth and role errors", async () => {
    serviceMocks.getChapters.mockRejectedValue(
      new CurriculumError("not_authenticated"),
    );
    expect(
      (
        await GET(
          new Request(
            `http://localhost/api/chapters?curriculumId=${curriculumId}`,
          ),
        )
      ).status,
    ).toBe(401);

    serviceMocks.createChapter.mockRejectedValue(
      new CurriculumError("forbidden"),
    );
    const response = await POST(jsonRequest("POST", { ...chapter, versionId }));
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("stack");
  });
});
