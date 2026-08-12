import { z } from "zod";

export const classIdSchema = z.uuid();
export const enrollmentIdSchema = z.uuid();
export const classCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(48)
  .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/);

const personIdSchema = z.uuid();

export const createClassSchema = z
  .object({
    code: classCodeSchema,
    description: z.string().trim().max(1000).optional(),
    grade: z.string().trim().min(1).max(80),
    name: z.string().trim().min(2).max(120),
    school: z.string().trim().min(1).max(160).optional().nullable(),
    schoolYear: z.number().int().min(100).max(999),
    semester: z.union([z.literal(1), z.literal(2)]),
    subject: z.string().trim().min(1).max(80),
    teacherId: personIdSchema,
  })
  .strict();

export const updateClassSchema = z
  .object({
    code: classCodeSchema.optional(),
    description: z.string().trim().max(1000).optional(),
    grade: z.string().trim().min(1).max(80).optional(),
    name: z.string().trim().min(2).max(120).optional(),
    school: z.string().trim().min(1).max(160).optional().nullable(),
    schoolYear: z.number().int().min(100).max(999).optional(),
    semester: z.union([z.literal(1), z.literal(2)]).optional(),
    status: z.enum(["active", "inactive"]).optional(),
    subject: z.string().trim().min(1).max(80).optional(),
    teacherId: personIdSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "至少需要一個更新欄位。",
  });

export const enrollStudentSchema = z
  .object({
    studentId: personIdSchema,
  })
  .strict();

export type CreateClassInput = z.infer<typeof createClassSchema>;
export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
