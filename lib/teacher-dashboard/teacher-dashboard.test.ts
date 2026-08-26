import {
  buildStudentRanking,
  buildTeachingInsights,
  buildTodayOverview,
  resolveRiskLevel,
  type StudentPerformance,
} from "@/lib/teacher-dashboard/domain";
import { createChartModel } from "@/lib/teacher-dashboard/chart";

const students: readonly StudentPerformance[] = [
  {
    accuracy: 0.42,
    activityCount: 8,
    masterySummary: {
      beginner: 3,
      developing: 2,
      mastered: 0,
      proficient: 1,
      unknown: 0,
    },
    metricReference: "metric-a",
    rank: 0,
    studentId: null,
  },
  {
    accuracy: 0.91,
    activityCount: 3,
    masterySummary: {
      beginner: 0,
      developing: 1,
      mastered: 5,
      proficient: 2,
      unknown: 0,
    },
    metricReference: "metric-b",
    rank: 0,
    studentId: null,
  },
];

describe("TD-001 teacher dashboard domain", () => {
  it("builds today's overview from reporting view models", () => {
    expect(
      buildTodayOverview({
        assignmentStatus: {
          inProgress: 1,
          overdue: 1,
          pending: 2,
          submitted: 6,
        },
        averageAccuracy: 0.75,
        learningTrend: [
          { accuracy: 0.8, date: "2026-07-30", questionCount: 12 },
        ],
        rosterLearners: 3,
        studentPerformance: students,
      }),
    ).toEqual({
      assignmentsDue: 3,
      assignmentCompletionRate: 0.6,
      averageAccuracy: 0.75,
      recentLearningActivity: 12,
      rosterLearners: 3,
      todaysActiveStudents: 2,
    });
  });

  it("sorts student ranking by teacher dashboard modes", () => {
    expect(
      buildStudentRanking(students, "needs_attention")[0]?.metricReference,
    ).toBe("metric-a");
    expect(
      buildStudentRanking(students, "highest_accuracy")[0]?.metricReference,
    ).toBe("metric-b");
    expect(
      Object.isFrozen(buildStudentRanking(students, "most_improved")),
    ).toBe(true);
  });

  it("builds rule-based teaching insights without calling AI", () => {
    const insights = buildTeachingInsights({
      classPerformance: [
        {
          assignmentCompletion: {
            assigned: 10,
            submissionRate: 0.4,
            submitted: 4,
          },
          averageAccuracy: 0.51,
          classId: "class-1",
          className: "五年甲班",
          knowledgeDistribution: {},
          learningTrend: [],
          learnerCount: 2,
          masteryDistribution: [],
        },
      ],
      weakKnowledge: [
        {
          affectedStudents: 5,
          knowledgePointId: "位值概念",
          recommendationCount: 8,
          riskLevel: "high",
        },
      ],
    });

    expect(insights[0]).toEqual(
      expect.objectContaining({
        recommendation: expect.stringContaining("複習 位值概念"),
        severity: "high",
      }),
    );
  });

  it("defines a chart adapter model without binding a chart library", () => {
    const chart = createChartModel({
      kind: "bar",
      points: [{ label: "五年甲班", value: 0.73456 }],
      title: "班級正確率",
    });

    expect(chart.points[0]?.value).toBe(0.7346);
    expect(chart).not.toHaveProperty("recharts");
    expect(chart).not.toHaveProperty("chartjs");
  });

  it("resolves weak knowledge risk level deterministically", () => {
    expect(
      resolveRiskLevel({ affectedStudents: 1, recommendationCount: 1 }),
    ).toBe("low");
    expect(
      resolveRiskLevel({ affectedStudents: 2, recommendationCount: 1 }),
    ).toBe("medium");
    expect(
      resolveRiskLevel({ affectedStudents: 5, recommendationCount: 1 }),
    ).toBe("high");
  });
});
