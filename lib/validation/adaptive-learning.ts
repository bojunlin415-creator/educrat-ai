import { z } from "zod";

export const adaptiveStudentRecommendationQuerySchema = z
  .object({
    studentId: z.uuid().optional(),
    subject: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const adaptivePathQuerySchema = adaptiveStudentRecommendationQuerySchema;

export const adaptiveWeakKnowledgeQuerySchema =
  adaptiveStudentRecommendationQuerySchema;

export const adaptiveDifficultyQuerySchema =
  adaptiveStudentRecommendationQuerySchema;

export type AdaptiveStudentRecommendationQuery = z.infer<
  typeof adaptiveStudentRecommendationQuerySchema
>;
