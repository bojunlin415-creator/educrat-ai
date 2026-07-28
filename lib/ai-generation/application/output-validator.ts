import type { GenerationContext } from "@/lib/ai-generation/domain/model";
import {
  createCurriculumGenerationOutput,
  curriculumGenerationSchema,
  type CurriculumGenerationOutput,
  type CurriculumGenerationQuestion,
} from "@/lib/ai-generation/domain/structured-output";

export interface OutputValidationSuccess {
  readonly output: CurriculumGenerationOutput;
  readonly success: true;
}

export interface OutputValidationFailure {
  readonly reason: "KNOWLEDGE_MAPPING_INVALID" | "STRUCTURED_OUTPUT_INVALID";
  readonly success: false;
}

export type OutputValidationResult =
  OutputValidationFailure | OutputValidationSuccess;

function hasValidKnowledgeMapping(
  context: GenerationContext,
  questions: readonly CurriculumGenerationQuestion[],
): boolean {
  const knownKnowledgePointIds = new Set(
    context.knowledgePoints.map((knowledgePoint) => knowledgePoint.id),
  );
  return questions.every(
    (question) =>
      question.knowledgePointIds.length > 0 &&
      question.knowledgePointIds.every((id) => knownKnowledgePointIds.has(id)),
  );
}

export function validateCurriculumOutput(
  context: GenerationContext,
  rawOutput: unknown,
): OutputValidationResult {
  const parsed = curriculumGenerationSchema.safeParse(rawOutput);
  if (!parsed.success) {
    return Object.freeze({
      reason: "STRUCTURED_OUTPUT_INVALID",
      success: false,
    });
  }
  const allQuestions = [
    ...parsed.data.questions,
    ...parsed.data.challengeQuestions,
  ];
  if (
    allQuestions.length !== context.questionCount ||
    !hasValidKnowledgeMapping(context, allQuestions)
  ) {
    return Object.freeze({
      reason: "KNOWLEDGE_MAPPING_INVALID",
      success: false,
    });
  }
  return Object.freeze({
    output: createCurriculumGenerationOutput(parsed.data),
    success: true,
  });
}
