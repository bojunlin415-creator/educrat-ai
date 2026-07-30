import { z } from "zod";

const trimmedTextSchema = z.string().trim().min(1).max(160);

export const learningEventIdSchema = z.uuid();
export const learningAnalyticsClassIdSchema = z.uuid();

export const createLearningEventSchema = z
  .object({
    assignmentId: z.uuid(),
    classId: z.uuid(),
    correct: z.boolean(),
    curriculumId: z.uuid(),
    curriculumVersionId: z.uuid(),
    difficulty: z.number().int().min(1).max(5),
    earnedScore: z.number().min(0).max(1000),
    grade: trimmedTextSchema.max(80),
    knowledgePointId: trimmedTextSchema,
    learningObjectiveId: trimmedTextSchema.nullish(),
    maxScore: z.number().positive().max(1000),
    questionId: trimmedTextSchema,
    studentId: z.uuid(),
    subject: trimmedTextSchema.max(80),
    submissionId: z.uuid(),
    timeSpentSeconds: z
      .number()
      .int()
      .min(0)
      .max(24 * 60 * 60),
  })
  .strict()
  .refine((data) => data.earnedScore <= data.maxScore, {
    message: "earnedScore must be less than or equal to maxScore",
    path: ["earnedScore"],
  });

export const studentSummaryQuerySchema = z
  .object({
    studentId: z.uuid().optional(),
  })
  .strict();

export const studentTimelineQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).optional(),
    studentId: z.uuid().optional(),
  })
  .strict();

export const knowledgeSummaryQuerySchema = z
  .object({
    knowledgePointId: trimmedTextSchema.optional(),
    studentId: z.uuid().optional(),
  })
  .strict();

export type CreateLearningEventInput = z.infer<
  typeof createLearningEventSchema
>;
export type KnowledgeSummaryQuery = z.infer<typeof knowledgeSummaryQuerySchema>;
export type StudentSummaryQuery = z.infer<typeof studentSummaryQuerySchema>;
export type StudentTimelineQuery = z.infer<typeof studentTimelineQuerySchema>;
