import { z } from "zod";

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).optional().nullable();

export const studentIdSchema = z.uuid();
export const studentGenderSchema = z.enum([
  "female",
  "male",
  "non_binary",
  "undisclosed",
]);
export const studentBirthdaySchema = z.iso
  .date()
  .refine((value) => value <= new Date().toISOString().slice(0, 10), {
    message: "生日不可晚於今天。",
  });

export const createStudentSchema = z
  .object({
    birthday: studentBirthdaySchema.optional().nullable(),
    englishName: optionalText(120),
    gender: studentGenderSchema,
    grade: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(120),
    school: optionalText(160),
    studentNo: z.string().trim().min(1).max(48),
  })
  .strict();

export const updateStudentSchema = createStudentSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少需要一個更新欄位。",
  });

export const listStudentsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).default(""),
  status: z.enum(["active", "archived", "all"]).default("active"),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
export type ListStudentsQuery = z.infer<typeof listStudentsQuerySchema>;
