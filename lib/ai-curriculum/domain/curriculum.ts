import type {
  AiCurriculumContractVersion,
  CurriculumDifficulty,
  CurriculumQuestionId,
  CurriculumQuestionType,
  KnowledgePointId,
} from "@/lib/ai-curriculum/shared/references";
import { AI_CURRICULUM_CONTRACT_VERSION } from "@/lib/ai-curriculum/shared/references";

export interface CurriculumQuestion {
  readonly answer: string;
  readonly answerSpaceLines: number;
  readonly difficulty: CurriculumDifficulty;
  readonly explanation?: string;
  readonly id: CurriculumQuestionId;
  readonly knowledgePointIds: readonly KnowledgePointId[];
  readonly prompt: string;
  readonly type: CurriculumQuestionType;
}

export interface CurriculumExample {
  readonly explanation: string;
  readonly knowledgePointIds: readonly KnowledgePointId[];
  readonly prompt: string;
  readonly solution: string;
}

export interface GeneratedCurriculum {
  readonly answers: readonly string[];
  readonly challengeQuestions: readonly CurriculumQuestion[];
  readonly examples: readonly CurriculumExample[];
  readonly exercises: readonly CurriculumQuestion[];
  readonly summaryPoints: readonly string[];
  readonly teacherReminders: readonly string[];
  readonly teachingGoals: readonly string[];
  readonly title: string;
  readonly version: AiCurriculumContractVersion;
}

function freezeQuestion(question: CurriculumQuestion): CurriculumQuestion {
  return Object.freeze({
    ...question,
    knowledgePointIds: Object.freeze([...question.knowledgePointIds]),
  });
}

function freezeExample(example: CurriculumExample): CurriculumExample {
  return Object.freeze({
    ...example,
    knowledgePointIds: Object.freeze([...example.knowledgePointIds]),
  });
}

export function createGeneratedCurriculum(
  input: Omit<GeneratedCurriculum, "version"> &
    Partial<Pick<GeneratedCurriculum, "version">>,
): GeneratedCurriculum {
  return Object.freeze({
    ...input,
    answers: Object.freeze([...input.answers]),
    challengeQuestions: Object.freeze(
      input.challengeQuestions.map(freezeQuestion),
    ),
    examples: Object.freeze(input.examples.map(freezeExample)),
    exercises: Object.freeze(input.exercises.map(freezeQuestion)),
    summaryPoints: Object.freeze([...input.summaryPoints]),
    teacherReminders: Object.freeze([...input.teacherReminders]),
    teachingGoals: Object.freeze([...input.teachingGoals]),
    version: input.version ?? AI_CURRICULUM_CONTRACT_VERSION,
  });
}
