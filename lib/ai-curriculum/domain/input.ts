import type { KnowledgePoint } from "@/lib/ai-curriculum/domain/knowledge-point";
import type {
  AiCurriculumContractVersion,
  CurriculumDifficulty,
  ElementaryGrade,
  LegacyPublisherReference,
} from "@/lib/ai-curriculum/shared/references";
import { AI_CURRICULUM_CONTRACT_VERSION } from "@/lib/ai-curriculum/shared/references";

export interface CurriculumGenerationInput {
  readonly book: string;
  readonly difficulty: CurriculumDifficulty;
  readonly grade: ElementaryGrade;
  readonly includeExplanations: boolean;
  readonly knowledgePoints: readonly KnowledgePoint[];
  readonly legacyPublisherReference?: LegacyPublisherReference;
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
    knowledgePoints: Object.freeze(
      input.knowledgePoints.map((knowledgePoint) =>
        Object.freeze({ ...knowledgePoint }),
      ),
    ),
    version: input.version ?? AI_CURRICULUM_CONTRACT_VERSION,
  });
}
