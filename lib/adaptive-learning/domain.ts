export const RECOMMENDED_DIFFICULTIES = ["easy", "normal", "hard"] as const;
export const RECOMMENDED_CURRICULUM_TYPES = ["remedial", "advanced"] as const;

export type RecommendedDifficulty = (typeof RECOMMENDED_DIFFICULTIES)[number];
export type RecommendedCurriculumType =
  (typeof RECOMMENDED_CURRICULUM_TYPES)[number];

export interface KnowledgeMasteryInput {
  readonly accuracy: number;
  readonly attemptCount: number;
  readonly knowledgePointId: string;
  readonly lastAnsweredAt: string;
  readonly masteryLevel: string;
  readonly masteryScore: number;
}

export interface TimelineInput {
  readonly answeredAt: string;
  readonly correct: boolean;
  readonly difficulty: number;
  readonly knowledgePointId: string;
}

export interface WeakKnowledgeSignal {
  readonly confidence: number;
  readonly knowledgePointId: string;
  readonly recommendationReason: string;
  readonly riskScore: number;
}

export interface KnowledgeGap {
  readonly blockedByKnowledgePointId: string;
  readonly impacts: readonly string[];
  readonly reason: string;
}

export interface DifficultyRecommendation {
  readonly knowledgePointId: string;
  readonly recommendedDifficulty: RecommendedDifficulty;
  readonly reason: string;
}

export interface LearningRecommendation {
  readonly id: string;
  readonly createdAt: string;
  readonly grade: string;
  readonly knowledgePointId: string;
  readonly organizationId: string;
  readonly reason: string;
  readonly recommendedCurriculumType: RecommendedCurriculumType;
  readonly recommendedDifficulty: RecommendedDifficulty;
  readonly recommendedQuestionCount: number;
  readonly studentId: string;
  readonly subject: string;
}

export interface LearningPathRecommendation {
  readonly current: string;
  readonly nextStep: string;
  readonly recommendedAbility: string;
  readonly recommendedCurriculum: string;
}

export interface AdaptiveLearningResult {
  readonly gaps: readonly KnowledgeGap[];
  readonly paths: readonly LearningPathRecommendation[];
  readonly recommendations: readonly Omit<
    LearningRecommendation,
    "createdAt" | "id"
  >[];
  readonly weakKnowledge: readonly WeakKnowledgeSignal[];
}

export function calculateRiskScore(input: KnowledgeMasteryInput): number {
  const accuracyRisk = 1 - clamp01(input.accuracy);
  const masteryRisk = 1 - clamp01(input.masteryScore);
  const attemptWeight = Math.min(1, input.attemptCount / 5);
  return Number(
    ((accuracyRisk * 0.55 + masteryRisk * 0.45) * attemptWeight).toFixed(4),
  );
}

export function calculateConfidence(input: KnowledgeMasteryInput): number {
  return Number(Math.min(1, input.attemptCount / 8).toFixed(4));
}

export function detectWeakKnowledge(
  mastery: readonly KnowledgeMasteryInput[],
): readonly WeakKnowledgeSignal[] {
  return mastery
    .map((item) => {
      const riskScore = calculateRiskScore(item);
      return {
        confidence: calculateConfidence(item),
        knowledgePointId: item.knowledgePointId,
        recommendationReason:
          item.attemptCount < 3
            ? "作答次數不足，需補充診斷。"
            : "正確率與掌握度偏低，建議補救練習。",
        riskScore,
      };
    })
    .filter((signal) => signal.riskScore >= 0.35)
    .sort((a, b) => b.riskScore - a.riskScore || b.confidence - a.confidence);
}

export function recommendDifficulty(input: {
  readonly mastery: KnowledgeMasteryInput;
  readonly recentTimeline: readonly TimelineInput[];
}): DifficultyRecommendation {
  const recent = input.recentTimeline
    .filter(
      (event) => event.knowledgePointId === input.mastery.knowledgePointId,
    )
    .slice(-5);
  const recentAccuracy =
    recent.length === 0
      ? input.mastery.accuracy
      : recent.filter((event) => event.correct).length / recent.length;

  if (input.mastery.masteryScore < 0.45 || recentAccuracy < 0.5) {
    return {
      knowledgePointId: input.mastery.knowledgePointId,
      reason: "近期表現或掌握度偏低，先降低難度鞏固基礎。",
      recommendedDifficulty: "easy",
    };
  }
  if (input.mastery.masteryScore >= 0.85 && recentAccuracy >= 0.8) {
    return {
      knowledgePointId: input.mastery.knowledgePointId,
      reason: "掌握度穩定，可提高挑戰。",
      recommendedDifficulty: "hard",
    };
  }
  return {
    knowledgePointId: input.mastery.knowledgePointId,
    reason: "掌握度接近穩定，維持一般難度練習。",
    recommendedDifficulty: "normal",
  };
}

export function analyzeKnowledgeGaps(
  weakKnowledge: readonly WeakKnowledgeSignal[],
): readonly KnowledgeGap[] {
  return weakKnowledge.map((signal, index) =>
    Object.freeze({
      blockedByKnowledgePointId: signal.knowledgePointId,
      impacts:
        index === 0
          ? ["下一階段解題穩定度", "跨單元應用能力"]
          : ["同主題進階概念"],
      reason: signal.recommendationReason,
    }),
  );
}

export function buildLearningPath(
  weakKnowledge: readonly WeakKnowledgeSignal[],
): readonly LearningPathRecommendation[] {
  return weakKnowledge.slice(0, 5).map((signal) =>
    Object.freeze({
      current: signal.knowledgePointId,
      nextStep: "先完成補救練習，再進入同主題一般難度。",
      recommendedAbility: "提高基礎正確率與作答穩定度。",
      recommendedCurriculum:
        signal.riskScore >= 0.5 ? "補救教材" : "混合練習教材",
    }),
  );
}

export function buildAdaptiveLearningResult(input: {
  readonly grade: string;
  readonly mastery: readonly KnowledgeMasteryInput[];
  readonly organizationId: string;
  readonly studentId: string;
  readonly subject: string;
  readonly timeline: readonly TimelineInput[];
}): AdaptiveLearningResult {
  const weakKnowledge = detectWeakKnowledge(input.mastery);
  const recommendations = weakKnowledge.slice(0, 10).map((signal) => {
    const mastery = input.mastery.find(
      (item) => item.knowledgePointId === signal.knowledgePointId,
    );
    if (!mastery) throw new Error("ADAPTIVE_MASTERY_NOT_FOUND");
    const difficulty = recommendDifficulty({
      mastery,
      recentTimeline: input.timeline,
    });
    return Object.freeze({
      grade: input.grade,
      knowledgePointId: signal.knowledgePointId,
      organizationId: input.organizationId,
      reason: `${signal.recommendationReason} ${difficulty.reason}`,
      recommendedCurriculumType:
        signal.riskScore >= 0.5 ? "remedial" : "advanced",
      recommendedDifficulty: difficulty.recommendedDifficulty,
      recommendedQuestionCount: signal.riskScore >= 0.7 ? 10 : 6,
      studentId: input.studentId,
      subject: input.subject,
    });
  });

  return Object.freeze({
    gaps: analyzeKnowledgeGaps(weakKnowledge),
    paths: buildLearningPath(weakKnowledge),
    recommendations,
    weakKnowledge,
  });
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
