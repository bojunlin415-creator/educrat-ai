import {
  chapterPatchSchema,
  createChapterSchema,
  createLessonSchema,
  lessonPatchSchema,
  reorderChaptersSchema,
} from "@/lib/validation/curriculum-hierarchy";

const versionId = "10000000-0000-4000-8000-000000000001";
const chapterId = "20000000-0000-4000-8000-000000000001";
const lessonId = "30000000-0000-4000-8000-000000000001";

describe("curriculum hierarchy validation", () => {
  it("accepts normalized chapter and lesson input", () => {
    expect(
      createChapterSchema.safeParse({
        chapterNo: 1,
        description: "整數概念",
        status: "draft",
        title: "整數",
        versionId,
      }).success,
    ).toBe(true);
    expect(
      createLessonSchema.safeParse({
        chapterId,
        estimatedMinutes: 40,
        learningObjectives: ["能比較整數大小"],
        lessonNo: 1,
        status: "active",
        teachingNotes: "先複習位值。",
        title: "認識大數",
      }).success,
    ).toBe(true);
  });

  it("rejects unknown tenant or hierarchy fields", () => {
    expect(
      createChapterSchema.safeParse({
        chapterNo: 1,
        description: "",
        organizationId: versionId,
        status: "draft",
        title: "整數",
        versionId,
      }).success,
    ).toBe(false);
    expect(
      createLessonSchema.safeParse({
        chapterId,
        estimatedMinutes: 40,
        learningObjectives: [],
        lessonNo: 1,
        status: "draft",
        teachingNotes: "",
        title: "課次",
        userId: versionId,
      }).success,
    ).toBe(false);
  });

  it("rejects duplicates, invalid status, and boundary violations", () => {
    expect(
      reorderChaptersSchema.safeParse({
        orderedIds: [chapterId, chapterId],
        versionId,
      }).success,
    ).toBe(false);
    expect(
      createChapterSchema.safeParse({
        chapterNo: 0,
        description: "",
        status: "published",
        title: "",
        versionId,
      }).success,
    ).toBe(false);
    expect(
      createLessonSchema.safeParse({
        chapterId,
        estimatedMinutes: 601,
        learningObjectives: ["x".repeat(301)],
        lessonNo: 1,
        status: "draft",
        teachingNotes: "x".repeat(5001),
        title: "課次",
      }).success,
    ).toBe(false);
  });

  it("discriminates update and reorder API actions", () => {
    expect(
      chapterPatchSchema.safeParse({
        action: "update",
        chapterId,
        chapterNo: 2,
        description: "更新",
        status: "active",
        title: "新標題",
      }).success,
    ).toBe(true);
    expect(
      lessonPatchSchema.safeParse({
        action: "update",
        estimatedMinutes: null,
        learningObjectives: [],
        lessonId,
        lessonNo: 2,
        status: "draft",
        teachingNotes: "",
        title: "新課次",
      }).success,
    ).toBe(true);
  });
});
