import type { KnowledgePoint } from "@/lib/ai-curriculum/domain/knowledge-point";
import type {
  AiCurriculumContractVersion,
  CurriculumDifficulty,
  ElementaryGrade,
  LearningStage,
} from "@/lib/ai-curriculum/shared/references";
import { AI_CURRICULUM_CONTRACT_VERSION } from "@/lib/ai-curriculum/shared/references";

export interface CurriculumGenerationInput {
  readonly competencyIndicators: readonly string[];
  readonly curriculumTopic: string;
  readonly difficulty: CurriculumDifficulty;
  readonly grade: ElementaryGrade;
  readonly includeExplanations: boolean;
  readonly knowledgePoints: readonly KnowledgePoint[];
  readonly learningObjectives: readonly string[];
  readonly learningStage: LearningStage;
  readonly purpose: string;
  readonly questionCount: number;
  readonly subject: string;
  readonly unit: string;
  readonly version: AiCurriculumContractVersion;
}

export function createCurriculumGenerationInput(
  input: Omit<CurriculumGenerationInput, "version"> &
    Partial<Pick<CurriculumGenerationInput, "version">>,
): CurriculumGenerationInput {
  return Object.freeze({
    ...input,
    competencyIndicators: Object.freeze([...input.competencyIndicators]),
    knowledgePoints: Object.freeze(
      input.knowledgePoints.map((knowledgePoint) =>
        Object.freeze({ ...knowledgePoint }),
      ),
    ),
    learningObjectives: Object.freeze([...input.learningObjectives]),
    version: input.version ?? AI_CURRICULUM_CONTRACT_VERSION,
  });
}
