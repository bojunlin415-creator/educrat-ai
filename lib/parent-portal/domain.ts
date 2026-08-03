import type { MasterySummary, TrendPoint } from "@/lib/reporting/domain";

export const GUARDIAN_RELATIONSHIP_TYPES = [
  "parent",
  "legal_guardian",
  "authorized_caregiver",
  "other_verified_guardian",
] as const;

export const GUARDIAN_RELATIONSHIP_STATUSES = [
  "pending",
  "verified",
  "active",
  "revoked",
] as const;

export type GuardianRelationshipType =
  (typeof GUARDIAN_RELATIONSHIP_TYPES)[number];
export type GuardianRelationshipStatus =
  (typeof GUARDIAN_RELATIONSHIP_STATUSES)[number];

export interface ParentPortalChild {
  readonly displayName: string;
  readonly grade: string | null;
  readonly relationshipType: GuardianRelationshipType;
  readonly studentId: string;
  readonly verifiedAt: string | null;
}

export interface ParentProgressSummary {
  readonly label: string;
  readonly masterySummary: MasterySummary;
  readonly overallAccuracyPercent: number;
  readonly status: "insufficient_data" | "needs_support" | "steady" | "strong";
}

export interface ParentWeakKnowledgeItem {
  readonly knowledgePointId: string;
  readonly priority: "observe" | "practice" | "review";
}

export interface ParentRecommendationItem {
  readonly difficulty: string;
  readonly knowledgePointId: string;
  readonly message: string;
}

export interface ParentAssignmentSummary {
  readonly counts: {
    readonly inProgress: number;
    readonly notStarted: number;
    readonly overdue: number;
    readonly submitted: number;
  };
  readonly recent: readonly {
    readonly dueAt: string;
    readonly status: string;
    readonly title: string;
  }[];
  readonly total: number;
}

export interface ParentInsight {
  readonly tone: "encouraging" | "needs_attention" | "not_enough_data";
  readonly title: string;
  readonly body: string;
}

export interface ParentStudentReportViewModel {
  readonly assignments: ParentAssignmentSummary;
  readonly child: ParentPortalChild;
  readonly insights: readonly ParentInsight[];
  readonly learningProgress: ParentProgressSummary;
  readonly recentActivity: readonly TrendPoint[];
  readonly recommendations: readonly ParentRecommendationItem[];
  readonly strengths: readonly string[];
  readonly weakKnowledge: readonly ParentWeakKnowledgeItem[];
}

export interface ParentPortalDashboardViewModel {
  readonly children: readonly ParentPortalChild[];
  readonly selectedStudentId: string | null;
  readonly selectedReport: ParentStudentReportViewModel | null;
}

export function buildParentProgressSummary(input: {
  readonly hasLearningData: boolean;
  readonly masterySummary: MasterySummary;
  readonly overallAccuracy: number;
}): ParentProgressSummary {
  if (!input.hasLearningData) {
    return Object.freeze({
      label: "目前資料不足，先觀察孩子開始作答後的變化。",
      masterySummary: input.masterySummary,
      overallAccuracyPercent: 0,
      status: "insufficient_data",
    });
  }

  const percent = Math.round(input.overallAccuracy * 100);
  if (input.overallAccuracy < 0.6) {
    return Object.freeze({
      label: "孩子目前有幾個知識點需要陪伴練習。",
      masterySummary: input.masterySummary,
      overallAccuracyPercent: percent,
      status: "needs_support",
    });
  }
  if (input.overallAccuracy >= 0.85) {
    return Object.freeze({
      label: "孩子近期表現穩定，可以安排更有挑戰的練習。",
      masterySummary: input.masterySummary,
      overallAccuracyPercent: percent,
      status: "strong",
    });
  }
  return Object.freeze({
    label: "孩子正在穩定累積能力，建議維持規律練習。",
    masterySummary: input.masterySummary,
    overallAccuracyPercent: percent,
    status: "steady",
  });
}

export function buildParentInsights(input: {
  readonly assignmentSummary: ParentAssignmentSummary;
  readonly hasLearningData: boolean;
  readonly progress: ParentProgressSummary;
  readonly weakKnowledgeCount: number;
}): readonly ParentInsight[] {
  if (!input.hasLearningData) {
    return Object.freeze([
      Object.freeze({
        body: "孩子完成第一批作答後，這裡會整理成容易理解的學習提醒。",
        title: "先從一次練習開始",
        tone: "not_enough_data",
      }),
    ]);
  }

  const insights: ParentInsight[] = [
    {
      body: input.progress.label,
      title: "本週學習概況",
      tone:
        input.progress.status === "needs_support"
          ? "needs_attention"
          : "encouraging",
    },
  ];
  if (input.assignmentSummary.counts.overdue > 0) {
    insights.push({
      body: "有作業已超過截止時間，可以先協助孩子完成最接近截止的項目。",
      title: "留意未完成作業",
      tone: "needs_attention",
    });
  }
  if (input.weakKnowledgeCount > 0) {
    insights.push({
      body: "弱點知識點不代表孩子不會，而是值得用短時間、重複的小練習穩定下來。",
      title: "建議安排短練習",
      tone: "encouraging",
    });
  }
  return Object.freeze(insights.map((insight) => Object.freeze(insight)));
}

export function mapWeakKnowledgeForParent(
  items: readonly {
    readonly knowledgePointId: string;
    readonly masteryScore: number;
  }[],
): readonly ParentWeakKnowledgeItem[] {
  return Object.freeze(
    items.slice(0, 5).map((item) =>
      Object.freeze({
        knowledgePointId: item.knowledgePointId,
        priority:
          item.masteryScore < 0.5
            ? "practice"
            : item.masteryScore < 0.7
              ? "review"
              : "observe",
      }),
    ),
  );
}

export function mapRecommendationsForParent(
  items: readonly {
    readonly difficulty: string;
    readonly knowledgePointId: string;
  }[],
): readonly ParentRecommendationItem[] {
  return Object.freeze(
    items.slice(0, 5).map((item) =>
      Object.freeze({
        difficulty: item.difficulty,
        knowledgePointId: item.knowledgePointId,
        message: `建議練習 ${item.knowledgePointId}，難易度可從 ${item.difficulty} 開始。`,
      }),
    ),
  );
}

export function buildStrengths(input: {
  readonly masterySummary: MasterySummary;
  readonly overallAccuracy: number;
}): readonly string[] {
  const strengths: string[] = [];
  if (input.overallAccuracy >= 0.8) strengths.push("整體正確率表現穩定");
  if (input.masterySummary.mastered > 0) {
    strengths.push(`已有 ${input.masterySummary.mastered} 個知識點達到精熟`);
  }
  if (input.masterySummary.proficient > 0) {
    strengths.push(
      `有 ${input.masterySummary.proficient} 個知識點接近穩定掌握`,
    );
  }
  return Object.freeze(
    strengths.length > 0 ? strengths : ["目前正在累積學習資料"],
  );
}
