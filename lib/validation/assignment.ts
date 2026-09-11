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

export const assignmentRecipientProjectionSchema = z
  .object({
    assigned_at: z.iso.datetime({ offset: true }),
    assignment_id: z.uuid(),
    canonical_student_id: z.uuid().nullable(),
    identity_authority: z.enum([
      "CANONICAL",
      "CANONICAL_WITH_LEGACY_COMPATIBILITY",
      "LEGACY_ONLY_HISTORICAL",
    ]),
    recipient_id: z.uuid().nullable(),
    recipient_status: z.enum([
      "not_started",
      "in_progress",
      "submitted",
      "overdue",
    ]),
    source_class_ids: z.array(z.uuid()).max(200),
  })
  .strict();

export const assignmentRecipientProjectionListSchema = z.array(
  assignmentRecipientProjectionSchema,
);

export const assignmentSubmissionResultSchema = z
  .object({
    assignment_id: z.uuid(),
    created_at: z.iso.datetime({ offset: true }),
    id: z.uuid(),
    identity_authority: z.enum(["CANONICAL", "LEGACY_ONLY_HISTORICAL"]),
    status: z.enum(["draft", "submitted"]),
    submitted_at: z.iso.datetime({ offset: true }).nullable(),
    updated_at: z.iso.datetime({ offset: true }),
  })
  .strict();

const isoDateTimeSchema = z.iso.datetime({ offset: true });
const uuidArraySchema = z.array(z.uuid()).min(1).max(200);

export const createAssignmentSchema = z
  .object({
    classIds: uuidArraySchema.optional(),
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
    classIds: uuidArraySchema.optional(),
    studentIds: uuidArraySchema.optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.studentIds?.length || value.classIds?.length),
    {
      message: "At least one student or class target is required.",
      path: ["studentIds"],
    },
  );

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
export type AssignmentSubmissionResult = z.infer<
  typeof assignmentSubmissionResultSchema
>;
export type UpdateAssignmentInput = z.infer<typeof updateAssignmentSchema>;
