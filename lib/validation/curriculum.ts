import { z } from "zod";

export const curriculumStatusSchema = z.enum(["draft", "active", "archived"]);

const curriculumFields = {
  gradeId: z.uuid("請選擇有效的年級。"),
  name: z
    .string()
    .trim()
    .min(2, "教材名稱至少需要 2 個字。")
    .max(120, "教材名稱不可超過 120 個字。"),
  publisherId: z.uuid("請選擇有效的出版社進度參考。"),
  schoolYear: z
    .number("學年度必須是數字。")
    .int("學年度必須是整數。")
    .min(100, "學年度不可小於 100。")
    .max(999, "學年度不可大於 999。"),
  semester: z.union([z.literal(1), z.literal(2)], {
    error: "請選擇上學期或下學期。",
  }),
  status: curriculumStatusSchema,
  subjectId: z.uuid("請選擇有效的科目。"),
};

export const curriculumFormSchema = z
  .object({
    ...curriculumFields,
    versionRemark: z.string().trim().max(1000, "版本備註不可超過 1000 個字。"),
  })
  .strict();

export const createCurriculumSchema = curriculumFormSchema.refine(
  (value) => value.status !== "archived",
  { message: "新教材不可直接設為封存。", path: ["status"] },
);

export const updateCurriculumSchema = z.object(curriculumFields).strict();

export const curriculumIdSchema = z.uuid("教材識別碼格式不正確。");

export const curriculumApiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  curriculum: z
    .object({
      id: z.string(),
      name: z.string(),
    })
    .optional(),
  redirectTo: z.string().optional(),
});

export type CurriculumFormInput = z.infer<typeof curriculumFormSchema>;
export type CreateCurriculumInput = z.infer<typeof createCurriculumSchema>;
export type UpdateCurriculumInput = z.infer<typeof updateCurriculumSchema>;
