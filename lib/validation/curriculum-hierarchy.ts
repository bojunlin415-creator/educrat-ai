import { z } from "zod";

export const editorContentStatusSchema = z.enum(["draft", "active"]);

const hierarchyIdSchema = z.uuid("識別碼格式不正確。");
const positiveSequenceSchema = z
  .number("編號必須是數字。")
  .int("編號必須是整數。")
  .min(1, "編號必須大於 0。")
  .max(9999, "編號不可大於 9999。");

const chapterFields = {
  chapterNo: positiveSequenceSchema,
  description: z.string().trim().max(3000, "章節說明不可超過 3000 個字。"),
  status: editorContentStatusSchema,
  title: z
    .string()
    .trim()
    .min(1, "請輸入章節標題。")
    .max(160, "章節標題不可超過 160 個字。"),
};

export const chapterEditorFormSchema = z.object(chapterFields).strict();

export const createChapterSchema = chapterEditorFormSchema
  .extend({ versionId: hierarchyIdSchema })
  .strict();

export const updateChapterSchema = z
  .object({
    ...chapterFields,
    chapterId: hierarchyIdSchema,
  })
  .strict();

export const deleteChapterSchema = z
  .object({ chapterId: hierarchyIdSchema })
  .strict();

export const reorderChaptersSchema = z
  .object({
    orderedIds: z
      .array(hierarchyIdSchema)
      .min(1, "至少需要一個章節。")
      .max(500, "一次最多排序 500 個章節。"),
    versionId: hierarchyIdSchema,
  })
  .strict()
  .refine(
    (value) => new Set(value.orderedIds).size === value.orderedIds.length,
    {
      message: "排序資料不可包含重複章節。",
      path: ["orderedIds"],
    },
  );

export const chapterPatchSchema = z.discriminatedUnion("action", [
  updateChapterSchema.extend({ action: z.literal("update") }),
  reorderChaptersSchema.extend({ action: z.literal("reorder") }),
]);

const lessonFields = {
  estimatedMinutes: z
    .number("預估時間必須是數字。")
    .int("預估時間必須是整數。")
    .min(1, "預估時間至少 1 分鐘。")
    .max(600, "預估時間不可超過 600 分鐘。")
    .nullable(),
  learningObjectives: z
    .array(
      z
        .string()
        .trim()
        .min(1, "學習目標不可為空白。")
        .max(300, "單一學習目標不可超過 300 個字。"),
    )
    .max(30, "學習目標最多 30 項。"),
  lessonNo: positiveSequenceSchema,
  status: editorContentStatusSchema,
  teachingNotes: z.string().trim().max(5000, "教學備註不可超過 5000 個字。"),
  title: z
    .string()
    .trim()
    .min(1, "請輸入課次標題。")
    .max(160, "課次標題不可超過 160 個字。"),
};

export const lessonEditorFormSchema = z.object(lessonFields).strict();

export const createLessonSchema = lessonEditorFormSchema
  .extend({ chapterId: hierarchyIdSchema })
  .strict();

export const updateLessonSchema = z
  .object({
    ...lessonFields,
    lessonId: hierarchyIdSchema,
  })
  .strict();

export const deleteLessonSchema = z
  .object({ lessonId: hierarchyIdSchema })
  .strict();

export const reorderLessonsSchema = z
  .object({
    chapterId: hierarchyIdSchema,
    orderedIds: z
      .array(hierarchyIdSchema)
      .min(1, "至少需要一個課次。")
      .max(500, "一次最多排序 500 個課次。"),
  })
  .strict()
  .refine(
    (value) => new Set(value.orderedIds).size === value.orderedIds.length,
    {
      message: "排序資料不可包含重複課次。",
      path: ["orderedIds"],
    },
  );

export const lessonPatchSchema = z.discriminatedUnion("action", [
  updateLessonSchema.extend({ action: z.literal("update") }),
  reorderLessonsSchema.extend({ action: z.literal("reorder") }),
]);

export const hierarchyListQuerySchema = z
  .object({ curriculumId: hierarchyIdSchema })
  .strict();

export const lessonListQuerySchema = z
  .object({ chapterId: hierarchyIdSchema })
  .strict();

export const hierarchyMutationResponseSchema = z.object({
  entityId: z.string().optional(),
  message: z.string(),
  success: z.boolean(),
});

export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type ChapterEditorFormInput = z.infer<typeof chapterEditorFormSchema>;
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>;
export type ReorderChaptersInput = z.infer<typeof reorderChaptersSchema>;
export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type LessonEditorFormInput = z.infer<typeof lessonEditorFormSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
export type ReorderLessonsInput = z.infer<typeof reorderLessonsSchema>;
