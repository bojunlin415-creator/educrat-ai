import { z } from "zod";

export const assignmentIdSchema = z.uuid();
export const assignmentStudentIdSchema = z.uuid();
export const assignmentStatusSchema = z.enum([
  "draft",
  "scheduled",
  "active",
  "cancelled",
  "closed",
]);

const isoDateTimeSchema = z.iso.datetime({ offset: true });
const uuidArraySchema = z.array(z.uuid()).min(1).max(200);

export const createAssignmentSchema = z
  .object({
    curriculumId: z.uuid(),
    curriculumVersionId: z.uuid(),
    description: z.string().trim().max(1000).optional(),
    dueAt: isoDateTimeSchema,
    publishAt: isoDateTimeSchema,
    studentIds: uuidArraySchema.optional(),
    title: z.string().trim().min(2).max(120),
  })
  .strict()
  .refine((value) => Date.parse(value.dueAt) >= Date.parse(value.publishAt), {
    message: "Due date must be after publish date.",
    path: ["dueAt"],
  });

export const updateAssignmentSchema = z
  .object({
    description: z.string().trim().max(1000).optional(),
    dueAt: isoDateTimeSchema.optional(),
    publishAt: isoDateTimeSchema.optional(),
    status: z.enum(["draft", "scheduled", "active", "cancelled"]).optional(),
    title: z.string().trim().min(2).max(120).optional(),
  })
  .strict()
  .refine(
    (value) =>
      !value.dueAt ||
      !value.publishAt ||
      Date.parse(value.dueAt) >= Date.parse(value.publishAt),
    {
      message: "Due date must be after publish date.",
      path: ["dueAt"],
    },
  );

export const assignStudentsSchema = z
  .object({
    studentIds: uuidArraySchema,
  })
  .strict();

export const submissionContentSchema = z
  .record(z.string().min(1).max(120), z.unknown())
  .refine((value) => JSON.stringify(value).length <= 16_000, {
    message: "Submission content is too large.",
  });

export const saveSubmissionSchema = z
  .object({
    content: submissionContentSchema,
  })
  .strict();

export type AssignStudentsInput = z.infer<typeof assignStudentsSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type SaveSubmissionInput = z.infer<typeof saveSubmissionSchema>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
