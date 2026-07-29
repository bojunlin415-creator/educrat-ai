import { z } from "zod";
import {
  curriculumGenerationSchema,
  type CurriculumGenerationOutput,
} from "@/lib/ai-generation";

const textArraySchema = z
  .array(z.string().trim().min(1).max(300))
  .min(1)
  .max(20);

export const aiCurriculumGenerationRequestSchema = z
  .object({
    competencyIndicators: textArraySchema,
    curriculumTopic: z.string().trim().min(2).max(120),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    grade: z.number().int().min(1).max(6),
    knowledgePoints: textArraySchema,
    language: z.enum(["zh-TW"]).default("zh-TW"),
    learningObjectives: textArraySchema,
    learningStage: z.string().trim().min(2).max(80),
    purpose: z.string().trim().min(2).max(200),
    questionCount: z.number().int().min(1).max(20),
    subject: z.string().trim().min(1).max(40),
  })
  .strict();

export const aiCurriculumGeneratedDraftSchema = curriculumGenerationSchema;

export const aiCurriculumSaveDraftSchema = z
  .object({
    clientRequestId: z.uuid(),
    generatedDraft: aiCurriculumGeneratedDraftSchema,
    gradeId: z.uuid(),
    originalDraft: aiCurriculumGeneratedDraftSchema.optional(),
    request: aiCurriculumGenerationRequestSchema,
    schoolYear: z.number().int().min(100).max(999),
    semester: z.union([z.literal(1), z.literal(2)]),
    subjectId: z.uuid(),
    curriculumReferenceId: z.uuid(),
  })
  .strict();

export type AICurriculumGenerationRequest = z.infer<
  typeof aiCurriculumGenerationRequestSchema
>;

export type AICurriculumSaveDraftInput = z.infer<
  typeof aiCurriculumSaveDraftSchema
>;

export type AICurriculumGeneratedDraft = CurriculumGenerationOutput;
