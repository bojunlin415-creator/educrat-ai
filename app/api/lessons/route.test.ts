import { CurriculumError } from "@/lib/curriculum/errors";
import { DELETE, GET, PATCH, POST } from "./route";

const serviceMocks = vi.hoisted(() => ({
  createLesson: vi.fn(),
  deleteLesson: vi.fn(),
  getLessons: vi.fn(),
  reorderLesson: vi.fn(),
  updateLesson: vi.fn(),
}));

vi.mock("@/lib/curriculum/service", () => serviceMocks);

const chapterId = "10000000-0000-4000-8000-000000000001";
const lessonId = "20000000-0000-4000-8000-000000000001";
const lesson = {
  estimatedMinutes: 40,
  learningObjectives: ["能說明位值"],
  lessonNo: 1,
  status: "draft",
  teachingNotes: "使用位值表。",
  title: "認識大數",
};

function jsonRequest(method: string, body: unknown) {
  return new Request("http://localhost/api/lessons", {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method,
  });
}

describe("lessons API", () => {
  afterEach(() => vi.clearAllMocks());

  it("lists lessons for a visible chapter", async () => {
    serviceMocks.getLessons.mockResolvedValue([]);
    const response = await GET(
      new Request(`http://localhost/api/lessons?chapterId=${chapterId}`),
    );
    expect(response.status).toBe(200);
    expect(serviceMocks.getLessons).toHaveBeenCalledWith(chapterId);
  });

  it("creates, updates, reorders, and deletes validated lessons", async () => {
    serviceMocks.createLesson.mockResolvedValue(lessonId);
    serviceMocks.updateLesson.mockResolvedValue(lessonId);
    serviceMocks.reorderLesson.mockResolvedValue([lessonId]);
    serviceMocks.deleteLesson.mockResolvedValue(lessonId);

    expect(
      (await POST(jsonRequest("POST", { chapterId, ...lesson }))).status,
    ).toBe(201);
    expect(
      (
        await PATCH(
          jsonRequest("PATCH", {
            action: "update",
            lessonId,
            ...lesson,
          }),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await PATCH(
          jsonRequest("PATCH", {
            action: "reorder",
            chapterId,
            orderedIds: [lessonId],
          }),
        )
      ).status,
    ).toBe(200);
    expect((await DELETE(jsonRequest("DELETE", { lessonId }))).status).toBe(
      200,
    );
  });

  it("rejects invalid content and unauthorized mutations safely", async () => {
    const invalidResponse = await POST(
      jsonRequest("POST", {
        chapterId,
        ...lesson,
        estimatedMinutes: 601,
      }),
    );
    expect(invalidResponse.status).toBe(422);
    expect(serviceMocks.createLesson).not.toHaveBeenCalled();

    serviceMocks.createLesson.mockRejectedValue(
      new CurriculumError("forbidden"),
    );
    const forbiddenResponse = await POST(
      jsonRequest("POST", { chapterId, ...lesson }),
    );
    expect(forbiddenResponse.status).toBe(403);
    expect(await forbiddenResponse.text()).not.toContain("stack");
  });
});
