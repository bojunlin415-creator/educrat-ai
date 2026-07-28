import type { GenerationRequest } from "@/lib/ai-generation/domain/model";
import {
  AI_GENERATION_CONTRACT_VERSION,
  AI_GENERATION_DIFFICULTIES,
} from "@/lib/ai-generation/shared/references";

function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

export function validateGenerationRequest(request: GenerationRequest): boolean {
  if (request.version !== AI_GENERATION_CONTRACT_VERSION) return false;
  if (isBlank(request.requestId) || isBlank(request.correlationId))
    return false;
  if (request.context.grade < 1 || request.context.grade > 6) return false;
  if (
    !AI_GENERATION_DIFFICULTIES.includes(request.context.difficulty) ||
    isBlank(request.context.subject) ||
    isBlank(request.context.unit) ||
    isBlank(request.context.curriculumReference)
  ) {
    return false;
  }
  if (
    !Number.isSafeInteger(request.context.questionCount) ||
    request.context.questionCount < 1 ||
    request.context.questionCount > 50
  ) {
    return false;
  }
  if (request.context.knowledgePoints.length === 0) return false;
  return request.context.knowledgePoints.every(
    (knowledgePoint) =>
      !isBlank(knowledgePoint.id) &&
      !isBlank(knowledgePoint.title) &&
      !isBlank(knowledgePoint.competencyIndicator),
  );
}
