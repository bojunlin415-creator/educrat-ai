import type { LearningRecommendation } from "@/lib/adaptive-learning/domain";

export interface CurriculumGenerationRecommendationPort {
  readonly prepareGenerationInput: (recommendation: LearningRecommendation) => {
    readonly difficulty: string;
    readonly grade: string;
    readonly knowledgePointId: string;
    readonly questionCount: number;
    readonly subject: string;
  };
}
