import {
  buildParentInsights,
  buildParentProgressSummary,
  buildStrengths,
  mapRecommendationsForParent,
  mapWeakKnowledgeForParent,
} from "@/lib/parent-portal/domain";

const masterySummary = {
  beginner: 1,
  developing: 2,
  mastered: 1,
  proficient: 1,
  unknown: 0,
};

describe("PP-001 parent portal domain", () => {
  it("maps student report into parent-friendly progress", () => {
    const progress = buildParentProgressSummary({
      hasLearningData: true,
      masterySummary,
      overallAccuracy: 0.86,
    });

    expect(progress.status).toBe("strong");
    expect(progress.overallAccuracyPercent).toBe(86);
  });

  it("creates insufficient-data parent insight", () => {
    const progress = buildParentProgressSummary({
      hasLearningData: false,
      masterySummary,
      overallAccuracy: 0,
    });
    const insights = buildParentInsights({
      assignmentSummary: {
        counts: { inProgress: 0, notStarted: 0, overdue: 0, submitted: 0 },
        recent: [],
        total: 0,
      },
      hasLearningData: false,
      progress,
      weakKnowledgeCount: 0,
    });

    expect(insights[0]?.tone).toBe("not_enough_data");
    expect(insights[0]?.body).not.toContain("mastery_score");
  });

  it("does not leak raw internal weakness reasons", () => {
    const weakKnowledge = mapWeakKnowledgeForParent([
      { knowledgePointId: "位值概念", masteryScore: 0.42 },
    ]);

    expect(weakKnowledge).toEqual([
      { knowledgePointId: "位值概念", priority: "practice" },
    ]);
    expect(JSON.stringify(weakKnowledge)).not.toContain("reason");
    expect(JSON.stringify(weakKnowledge)).not.toContain("masteryScore");
  });

  it("summarizes recommendations without internal AI reasons", () => {
    const recommendations = mapRecommendationsForParent([
      { difficulty: "easy", knowledgePointId: "分數加減" },
    ]);

    expect(recommendations[0]?.message).toContain("建議練習");
    expect(JSON.stringify(recommendations)).not.toContain("internal_reason");
  });

  it("builds strengths from mastery summary", () => {
    expect(buildStrengths({ masterySummary, overallAccuracy: 0.82 })).toContain(
      "整體正確率表現穩定",
    );
  });
});
