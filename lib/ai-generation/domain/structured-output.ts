import { z } from "zod";

import type { AiGenerationDifficulty } from "@/lib/ai-generation/shared/references";

export const curriculumQuestionSchema = z
  .object({
    answer: z.string().trim().min(1),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    explanation: z.string().trim().min(1).optional(),
    knowledgePointIds: z.array(z.string().trim().min(1)).min(1),
    prompt: z.string().trim().min(1),
  })
  .strict();

export const curriculumExampleSchema = z
  .object({
    explanation: z.string().trim().min(1),
    knowledgePointIds: z.array(z.string().trim().min(1)).min(1),
    prompt: z.string().trim().min(1),
    solution: z.string().trim().min(1),
  })
  .strict();

export const curriculumGenerationSchema = z
  .object({
    challengeQuestions: z.array(curriculumQuestionSchema),
    examples: z.array(curriculumExampleSchema).min(1),
    knowledgePoints: z
      .array(
        z
          .object({
            id: z.string().trim().min(1),
            title: z.string().trim().min(1),
          })
          .strict(),
      )
      .min(1),
    learningObjectives: z.array(z.string().trim().min(1)).min(1),
    questions: z.array(curriculumQuestionSchema),
    solutions: z.array(z.string().trim().min(1)).min(1),
    summary: z.array(z.string().trim().min(1)).min(1),
    teacherNotes: z.array(z.string().trim().min(1)).min(1),
    title: z.string().trim().min(1),
  })
  .strict();

export interface CurriculumGenerationQuestion {
  readonly answer: string;
  readonly difficulty: AiGenerationDifficulty;
  readonly explanation?: string;
  readonly knowledgePointIds: readonly string[];
  readonly prompt: string;
}

export interface CurriculumGenerationExample {
  readonly explanation: string;
  readonly knowledgePointIds: readonly string[];
  readonly prompt: string;
  readonly solution: string;
}

export interface CurriculumGenerationKnowledgePoint {
  readonly id: string;
  readonly title: string;
}

export interface CurriculumGenerationOutput {
  readonly challengeQuestions: readonly CurriculumGenerationQuestion[];
  readonly examples: readonly CurriculumGenerationExample[];
  readonly knowledgePoints: readonly CurriculumGenerationKnowledgePoint[];
  readonly learningObjectives: readonly string[];
  readonly questions: readonly CurriculumGenerationQuestion[];
  readonly solutions: readonly string[];
  readonly summary: readonly string[];
  readonly teacherNotes: readonly string[];
  readonly title: string;
}

export function createCurriculumGenerationOutput(
  input: CurriculumGenerationOutput,
): CurriculumGenerationOutput {
  return Object.freeze({
    ...input,
    challengeQuestions: Object.freeze(
      input.challengeQuestions.map((question) =>
        Object.freeze({
          ...question,
          knowledgePointIds: Object.freeze([...question.knowledgePointIds]),
        }),
      ),
    ),
    examples: Object.freeze(
      input.examples.map((example) =>
        Object.freeze({
          ...example,
          knowledgePointIds: Object.freeze([...example.knowledgePointIds]),
        }),
      ),
    ),
    knowledgePoints: Object.freeze(
      input.knowledgePoints.map((knowledgePoint) =>
        Object.freeze({ ...knowledgePoint }),
      ),
    ),
    learningObjectives: Object.freeze([...input.learningObjectives]),
    questions: Object.freeze(
      input.questions.map((question) =>
        Object.freeze({
          ...question,
          difficulty: question.difficulty as AiGenerationDifficulty,
          knowledgePointIds: Object.freeze([...question.knowledgePointIds]),
        }),
      ),
    ),
    solutions: Object.freeze([...input.solutions]),
    summary: Object.freeze([...input.summary]),
    teacherNotes: Object.freeze([...input.teacherNotes]),
  });
}
