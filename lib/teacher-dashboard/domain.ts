import type {
  OrganizationReportViewModel,
  StudentReportViewModel,
  TeacherReportViewModel,
  TrendPoint,
} from "@/lib/reporting/domain";

export type DashboardRiskLevel = "high" | "low" | "medium";
export type StudentRankingMode =
  "highest_accuracy" | "highest_activity" | "most_improved" | "needs_attention";

export interface TodayOverview {
  readonly assignmentsDue: number;
  readonly assignmentCompletionRate: number;
  readonly averageAccuracy: number;
  readonly recentLearningActivity: number;
  readonly rosterLearners: number;
  readonly todaysActiveStudents: number;
}

export interface TeachingInsight {
  readonly evidence: string;
  readonly recommendation: string;
  readonly severity: DashboardRiskLevel;
  readonly title: string;
}

export interface ClassPerformance {
  readonly assignmentCompletion: TeacherReportViewModel["assignmentCompletion"];
  readonly averageAccuracy: number;
  readonly classId: string;
  readonly className: string;
  readonly knowledgeDistribution: OrganizationReportViewModel["knowledgeDistribution"];
  readonly learningTrend: readonly TrendPoint[];
  readonly learnerCount: number;
  readonly masteryDistribution: TeacherReportViewModel["weakKnowledgeRanking"];
}

export interface StudentPerformance {
  readonly accuracy: number;
  readonly activityCount: number;
  readonly masterySummary: StudentReportViewModel["masterySummary"];
  readonly metricReference: string;
  readonly rank: number;
  readonly studentId: string | null;
}

export interface TeacherDashboardLearnerPopulationEntry {
  readonly classId: string;
  readonly displayName: string | null;
  readonly membershipId: string;
  readonly membershipStatus: "active";
  readonly studentId: string | null;
  readonly studentStatus: "active" | "archived" | null;
}

export interface WeakKnowledgeDashboardItem {
  readonly affectedStudents: number;
  readonly knowledgePointId: string;
  readonly recommendationCount: number;
  readonly riskLevel: DashboardRiskLevel;
}

export interface RecommendationDashboardItem {
  readonly knowledgePointId: string;
  readonly reason: string;
  readonly recommendedDifficulty: string;
  readonly recommendedTopic: string;
  readonly recommendedWorksheet: string;
}

export interface AssignmentStatusSummary {
  readonly inProgress: number;
  readonly overdue: number;
  readonly pending: number;
  readonly submitted: number;
}

export interface TeacherDashboardViewModel {
  readonly assignmentStatus: AssignmentStatusSummary;
  readonly classPerformance: readonly ClassPerformance[];
  readonly generatedAt: string;
  readonly insights: readonly TeachingInsight[];
  readonly learnerPopulation: readonly TeacherDashboardLearnerPopulationEntry[];
  readonly learnerPopulationCount: number;
  readonly recommendations: readonly RecommendationDashboardItem[];
  readonly studentPerformance: readonly StudentPerformance[];
  readonly todayOverview: TodayOverview;
  readonly weakKnowledge: readonly WeakKnowledgeDashboardItem[];
}

export function buildTodayOverview(input: {
  readonly assignmentStatus: AssignmentStatusSummary;
  readonly averageAccuracy: number;
  readonly learningTrend: readonly TrendPoint[];
  readonly rosterLearners: number;
  readonly studentPerformance: readonly StudentPerformance[];
}): TodayOverview {
  const totalAssignments =
    input.assignmentStatus.pending +
    input.assignmentStatus.inProgress +
    input.assignmentStatus.submitted +
    input.assignmentStatus.overdue;
  return Object.freeze({
    assignmentsDue:
      input.assignmentStatus.pending + input.assignmentStatus.overdue,
    assignmentCompletionRate:
      totalAssignments === 0
        ? 0
        : Number(
            (input.assignmentStatus.submitted / totalAssignments).toFixed(4),
          ),
    averageAccuracy: input.averageAccuracy,
    recentLearningActivity: input.learningTrend.reduce(
      (sum, point) => sum + point.questionCount,
      0,
    ),
    rosterLearners: input.rosterLearners,
    todaysActiveStudents: input.studentPerformance.filter(
      (student) => student.activityCount > 0,
    ).length,
  });
}

export function buildTeachingInsights(input: {
  readonly classPerformance: readonly ClassPerformance[];
  readonly weakKnowledge: readonly WeakKnowledgeDashboardItem[];
}): readonly TeachingInsight[] {
  const insights: TeachingInsight[] = [];
  const weakest = input.weakKnowledge[0];
  if (weakest) {
    insights.push(
      Object.freeze({
        evidence: `${weakest.affectedStudents} 位學生受到影響，${weakest.recommendationCount} 筆建議待處理。`,
        recommendation: `下一堂課先複習 ${weakest.knowledgePointId}，再派發補救練習。`,
        severity: weakest.riskLevel,
        title: `${weakest.knowledgePointId} 需要優先關注`,
      }),
    );
  }
  const decliningClass = input.classPerformance.find(
    (classroom) => classroom.averageAccuracy < 0.6,
  );
  if (decliningClass) {
    insights.push(
      Object.freeze({
        evidence: `${decliningClass.className} 平均正確率為 ${Math.round(
          decliningClass.averageAccuracy * 100,
        )}%。`,
        recommendation: "建議先進行共同錯題講解，再安排分層練習。",
        severity: "medium",
        title: "班級整體表現偏低",
      }),
    );
  }
  if (insights.length === 0) {
    insights.push(
      Object.freeze({
        evidence: "目前班級正確率與弱點分布沒有明顯警訊。",
        recommendation: "維持目前教學節奏，並觀察下一次派發結果。",
        severity: "low",
        title: "學習狀態穩定",
      }),
    );
  }
  return Object.freeze(insights);
}

export function buildStudentRanking(
  students: readonly StudentPerformance[],
  mode: StudentRankingMode,
): readonly StudentPerformance[] {
  const sorted = [...students].sort((a, b) => {
    switch (mode) {
      case "highest_accuracy":
        return b.accuracy - a.accuracy || b.activityCount - a.activityCount;
      case "highest_activity":
        return b.activityCount - a.activityCount || b.accuracy - a.accuracy;
      case "most_improved":
        return b.masterySummary.mastered - a.masterySummary.mastered;
      case "needs_attention":
        return a.accuracy - b.accuracy || b.activityCount - a.activityCount;
    }
  });
  return Object.freeze(
    sorted.map((student, index) =>
      Object.freeze({
        ...student,
        rank: index + 1,
      }),
    ),
  );
}

export function resolveRiskLevel(input: {
  readonly affectedStudents: number;
  readonly recommendationCount: number;
}): DashboardRiskLevel {
  if (input.affectedStudents >= 5 || input.recommendationCount >= 8) {
    return "high";
  }
  if (input.affectedStudents >= 2 || input.recommendationCount >= 3) {
    return "medium";
  }
  return "low";
}
