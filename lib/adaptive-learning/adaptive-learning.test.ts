import {
  analyzeKnowledgeGaps,
  buildAdaptiveLearningResult,
  buildLearningPath,
  calculateConfidence,
  calculateRiskScore,
  detectWeakKnowledge,
  recommendDifficulty,
  type KnowledgeMasteryInput,
  type TimelineInput,
} from "@/lib/adaptive-learning/domain";

const weakMastery: KnowledgeMasteryInput = {
  accuracy: 0.35,
  attemptCount: 8,
  knowledgePointId: "place-value",
  lastAnsweredAt: "2026-07-30T00:00:00.000Z",
  masteryLevel: "beginner",
  masteryScore: 0.28,
};

const strongMastery: KnowledgeMasteryInput = {
  accuracy: 0.92,
  attemptCount: 10,
  knowledgePointId: "addition",
  lastAnsweredAt: "2026-07-30T00:10:00.000Z",
  masteryLevel: "mastered",
  masteryScore: 0.92,
};

const timeline: readonly TimelineInput[] = [
  {
    answeredAt: "2026-07-30T00:00:00.000Z",
    correct: false,
    difficulty: 3,
    knowledgePointId: "place-value",
  },
  {
    answeredAt: "2026-07-30T00:01:00.000Z",
    correct: true,
    difficulty: 3,
    knowledgePointId: "place-value",
  },
  {
    answeredAt: "2026-07-30T00:02:00.000Z",
    correct: false,
    difficulty: 4,
    knowledgePointId: "place-value",
  },
];

describe("AI-002 adaptive learning domain", () => {
  it("detects weak knowledge from mastery and confidence", () => {
    expect(calculateRiskScore(weakMastery)).toBeGreaterThan(0.5);
    expect(calculateConfidence(weakMastery)).toBe(1);
    expect(detectWeakKnowledge([strongMastery, weakMastery])).toEqual([
      expect.objectContaining({
        knowledgePointId: "place-value",
        recommendationReason: expect.stringContaining("補救"),
      }),
    ]);
  });

  it("recommends difficulty from mastery and recent trend", () => {
    expect(
      recommendDifficulty({
        mastery: weakMastery,
        recentTimeline: timeline,
      }).recommendedDifficulty,
    ).toBe("easy");
    expect(
      recommendDifficulty({
        mastery: strongMastery,
        recentTimeline: [
          {
            answeredAt: "2026-07-30T00:03:00.000Z",
            correct: true,
            difficulty: 4,
            knowledgePointId: "addition",
          },
        ],
      }).recommendedDifficulty,
    ).toBe("hard");
  });

  it("builds knowledge gap and learning path recommendations", () => {
    const weakKnowledge = detectWeakKnowledge([weakMastery]);
    expect(analyzeKnowledgeGaps(weakKnowledge)).toEqual([
      expect.objectContaining({
        blockedByKnowledgePointId: "place-value",
        impacts: expect.arrayContaining(["下一階段解題穩定度"]),
      }),
    ]);
    expect(buildLearningPath(weakKnowledge)).toEqual([
      expect.objectContaining({
        current: "place-value",
        recommendedCurriculum: "補救教材",
      }),
    ]);
  });

  it("builds adaptive recommendations without calling AI generation", () => {
    const result = buildAdaptiveLearningResult({
      grade: "國小三年級",
      mastery: [weakMastery, strongMastery],
      organizationId: "org-1",
      studentId: "student-1",
      subject: "數學",
      timeline,
    });
    expect(result.recommendations).toEqual([
      expect.objectContaining({
        knowledgePointId: "place-value",
        recommendedCurriculumType: "remedial",
        recommendedDifficulty: "easy",
      }),
    ]);
    expect(Object.isFrozen(result)).toBe(true);
  });
});
